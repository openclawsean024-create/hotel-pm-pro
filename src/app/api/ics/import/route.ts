// app/api/ics/import/route.ts — F-M9 ICS 匯入端點
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";
import { parseIcsText, IcsParseError, IcsEvent as ParsedIcsEvent } from "@/lib/ics-parser";

const importSchema = z.object({
  propertyId: z.string().min(1),
  icsUrl: z.string().min(1),
  source: z.enum(["airbnb", "booking", "manual"]).default("airbnb"),
});

const FETCH_TIMEOUT_MS = 10_000;

function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

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

  // 基本 URL 格式檢查
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(icsUrl);
  } catch {
    return NextResponse.json({ error: "ICS 連結格式錯誤" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "ICS 連結僅支援 http(s)" }, { status: 400 });
  }

  // 確認 property 屬於當前 user
  const prop = await pgQueryOne<{ id: string }>(
    `SELECT id FROM "Property" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [propertyId, session.user.id]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  // 抓 ICS text（10s timeout）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let text: string;
  try {
    const res = await fetch(icsUrl, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ICS 來源回應 ${res.status}` },
        { status: 502 }
      );
    }
    text = await res.text();
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "ICS 來源超過 10 秒未回應" : "無法取得 ICS 內容" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
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

  // 寫入 IcsEvent（ON CONFLICT (userId, uid) DO NOTHING 處理重複）
  let imported = 0;
  let skipped = 0;
  for (const ev of events) {
    const inserted = await pgQueryOne<{ id: string }>(
      `INSERT INTO "IcsEvent" (id, "userId", "propertyId", uid, summary, "checkIn", "checkOut", source, "importedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT ("userId", uid) DO NOTHING
       RETURNING id`,
      [
        generateId(),
        session.user.id,
        propertyId,
        ev.uid,
        ev.summary,
        ev.checkIn.toISOString(),
        ev.checkOut.toISOString(),
        source,
      ]
    );
    if (inserted) imported++;
    else skipped++;
  }

  return NextResponse.json({
    imported,
    skipped,
    events: events.map((e) => ({
      uid: e.uid,
      summary: e.summary,
      checkIn: e.checkIn.toISOString(),
      checkOut: e.checkOut.toISOString(),
    })),
  });
}
