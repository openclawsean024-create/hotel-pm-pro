// app/api/ics/import/route.ts — ICS 匯入並轉成訂房（AC-007，FR-011）
//
// 流程：驗證輸入 → URL 語法檢查 → 確認物業屬於使用者 → 以 SSRF 防護抓取 ICS
//       → 解析 → 逐筆寫入 IcsEvent（以 UID 去重）並建立對應的 Booking。
//
// 轉訂房規則：
//   - Booking.id 由 (userId, UID) 決定性產生，所以同一個 UID 重複匯入不會產生第二筆訂房。
//   - channel = 匯入來源（airbnb／booking／manual）；guestName = ICS 的 SUMMARY。
//     ICS 沒有金額，totalPrice 一律 0、status = confirmed（不會進月報收入，月報只算 completed）。
//   - 與同一物業未取消的訂房重疊時不建立訂房，計入 overlapped 並在回應中標記。
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQueryOne, withTransaction } from "@/lib/pg-client";
import { parseIcsText, IcsParseError, type IcsEvent as ParsedIcsEvent } from "@/lib/ics-parser";
import { findOverlappingBookings, PROPERTY_BOOKING_LOCK_SQL, type ExistingBooking } from "@/lib/booking-rules";
import { icsBookingId } from "@/lib/ics-booking";
import {
  FetchTimeoutError,
  ResponseTooLargeError,
  safeFetchText,
  UnsafeUrlError,
  validateUrlSyntax,
} from "@/lib/safe-fetch";

const importSchema = z.object({
  propertyId: z.string().min(1),
  icsUrl: z.string().min(1).max(2000),
  source: z.enum(["airbnb", "booking", "manual"]).default("airbnb"),
});

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ICS_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS = 1000;

type BookingOutcome = "created" | "existing" | "overlapped";

function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON 內容" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "驗證失敗" },
      { status: 400 }
    );
  }

  const { propertyId, icsUrl, source } = parsed.data;

  // URL 語法檢查（https、不含帳密、不是內部位址）；DNS 解析檢查在抓取時進行。
  try {
    validateUrlSyntax(icsUrl);
  } catch (err) {
    return NextResponse.json(
      { error: `ICS ${err instanceof UnsafeUrlError ? err.message : "連結格式錯誤"}` },
      { status: 400 }
    );
  }

  // 確認 property 屬於當前 user
  const prop = await pgQueryOne<{ id: string }>(
    `SELECT id FROM "Property" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [propertyId, userId]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  // 抓 ICS（SSRF 防護、10 秒逾時、2 MB 上限）
  let text: string;
  try {
    text = await safeFetchText(icsUrl, { timeoutMs: FETCH_TIMEOUT_MS, maxBytes: MAX_ICS_BYTES });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: `ICS ${err.message}` }, { status: 400 });
    }
    if (err instanceof FetchTimeoutError) {
      return NextResponse.json({ error: "ICS 來源超過 10 秒未回應" }, { status: 504 });
    }
    if (err instanceof ResponseTooLargeError) {
      return NextResponse.json({ error: "ICS 檔案超過 2 MB 上限" }, { status: 413 });
    }
    return NextResponse.json(
      { error: err instanceof Error && err.name === "UpstreamError" ? `ICS ${err.message}` : "無法取得 ICS 內容" },
      { status: 502 }
    );
  }

  // 解析
  let events: ParsedIcsEvent[];
  try {
    events = parseIcsText(text);
  } catch (err) {
    if (err instanceof IcsParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ICS 解析失敗" }, { status: 400 });
  }
  if (events.length > MAX_EVENTS) {
    return NextResponse.json({ error: `ICS 事件數超過上限（${MAX_EVENTS} 筆）` }, { status: 400 });
  }

  // 檢查重疊與寫入訂房在同一個交易，並持有這個物業的鎖（與手動新增訂房共用），避免同時寫入造成重複訂房。
  const summary = await withTransaction(async (db) => {
    await db.query(PROPERTY_BOOKING_LOCK_SQL, [propertyId]);
    // 這個物業目前未取消的訂房（重疊檢查用），以及這批 UID 已經建立過的訂房（去重用）。
    const occupied = await db.query<ExistingBooking>(
      `SELECT id, "checkIn", "checkOut", status
         FROM "Booking"
        WHERE "userId" = $1 AND "propertyId" = $2 AND status <> 'cancelled'`,
      [userId, propertyId]
    );
    const bookingIds = events.map((ev) => icsBookingId(userId, ev.uid));
    const alreadyBooked = new Set(
      events.length === 0
        ? []
        : (
            await db.query<{ id: string }>(
              `SELECT id FROM "Booking" WHERE "userId" = $1 AND id = ANY($2::text[])`,
              [userId, bookingIds]
            )
          ).map((r) => r.id)
    );

    let imported = 0;
    let skipped = 0;
    let bookingsCreated = 0;
    let bookingsExisting = 0;
    let overlapped = 0;
    const results: Array<{
      uid: string;
      summary: string;
      checkIn: string;
      checkOut: string;
      booking: BookingOutcome;
    }> = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const checkIn = ev.checkIn.toISOString();
      const checkOut = ev.checkOut.toISOString();

      // 1) 原始事件紀錄：ON CONFLICT (userId, uid) DO NOTHING 處理重複
      const inserted = await db.queryOne<{ id: string }>(
        `INSERT INTO "IcsEvent" (id, "userId", "propertyId", uid, summary, "checkIn", "checkOut", source, "importedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT ("userId", uid) DO NOTHING
         RETURNING id`,
        [generateId(), userId, propertyId, ev.uid, ev.summary, checkIn, checkOut, source]
      );
      if (inserted) imported++;
      else skipped++;

      // 2) 轉成訂房
      const bookingId = bookingIds[i];
      let outcome: BookingOutcome;
      if (alreadyBooked.has(bookingId)) {
        outcome = "existing";
      } else if (findOverlappingBookings({ checkIn, checkOut }, occupied).length > 0) {
        outcome = "overlapped";
      } else {
        const created = await db.queryOne<{ id: string }>(
          `INSERT INTO "Booking" (id, "guestName", "propertyId", "userId", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'confirmed', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [bookingId, ev.summary.slice(0, 100), propertyId, userId, checkIn, checkOut, source]
        );
        if (created) {
          outcome = "created";
          occupied.push({ id: bookingId, checkIn, checkOut, status: "confirmed" });
        } else {
          outcome = "existing";
        }
        alreadyBooked.add(bookingId);
      }
      if (outcome === "created") bookingsCreated++;
      else if (outcome === "existing") bookingsExisting++;
      else overlapped++;

      results.push({ uid: ev.uid, summary: ev.summary, checkIn, checkOut, booking: outcome });
    }

    return { imported, skipped, bookingsCreated, bookingsExisting, overlapped, results };
  });
  const { imported, skipped, bookingsCreated, bookingsExisting, overlapped, results } = summary;

  return NextResponse.json({
    imported,
    skipped,
    bookingsCreated,
    bookingsExisting,
    overlapped,
    events: results,
  });
}
