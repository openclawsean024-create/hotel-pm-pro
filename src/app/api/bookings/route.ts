// app/api/bookings/route.ts — Bookings CRUD (F-M3 訂房看板；AC-005 重疊檢查)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";
import { parseDateStrict, toTaipeiDateISO } from "@/lib/dates";
import { findOverlappingBookings, validateBookingDates, type ExistingBooking } from "@/lib/booking-rules";

const createSchema = z.object({
  propertyId: z.string().min(1),
  guestName: z.string().min(1).max(100),
  checkIn: z.string().min(1), // ISO date
  checkOut: z.string().min(1),
  channel: z.enum(["airbnb", "booking", "manual"]).default("manual"),
  totalPrice: z.number().int().min(0),
  status: z.enum(["confirmed", "cancelled", "completed"]).default("confirmed"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  let query = `SELECT id, "guestName", "propertyId", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt"
               FROM "Booking"
               WHERE "userId" = $1`;
  const params: unknown[] = [session.user.id];

  if (propertyId) {
    query += ` AND "propertyId" = $2`;
    params.push(propertyId);
  }
  query += ` ORDER BY "checkIn" DESC`;

  const bookings = await pgQuery(query, params);
  return NextResponse.json({ bookings });
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "驗證失敗" }, { status: 400 });
  }
  const { propertyId, guestName, channel, totalPrice, status } = parsed.data;

  // 日期規則（AC-005）：兩個日期都要有效，且退房日必須晚於入住日。
  const dateErrors = validateBookingDates(parsed.data.checkIn, parsed.data.checkOut);
  if (dateErrors.length > 0) {
    return NextResponse.json({ error: dateErrors[0] }, { status: 400 });
  }
  const checkIn = parseDateStrict(parsed.data.checkIn, "checkIn").toISOString();
  const checkOut = parseDateStrict(parsed.data.checkOut, "checkOut").toISOString();

  const prop = await pgQueryOne<{ id: string }>(
    `SELECT id FROM "Property" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [propertyId, session.user.id]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  // 重疊檢查（AC-005，FR-010）：同一物業、未取消的訂房不可重疊；相鄰（退房日 = 下一筆入住日）不算。
  // 建立的訂房本身若是 cancelled，不佔用日期，不需檢查。
  if (status !== "cancelled") {
    const candidates = await pgQuery<ExistingBooking & { guestName: string }>(
      `SELECT id, "guestName", "checkIn", "checkOut", status
         FROM "Booking"
        WHERE "userId" = $1
          AND "propertyId" = $2
          AND status <> 'cancelled'
          AND "checkIn" < $3
          AND "checkOut" > $4`,
      [session.user.id, propertyId, checkOut, checkIn]
    );
    const conflicts = findOverlappingBookings({ checkIn, checkOut }, candidates);
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "此物業在這段日期已有訂房，無法重複訂房",
          conflicts: conflicts.map((c) => ({
            id: c.id,
            checkIn: toTaipeiDateISO(c.checkIn, "checkIn"),
            checkOut: toTaipeiDateISO(c.checkOut, "checkOut"),
          })),
        },
        { status: 409 }
      );
    }
  }

  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  await pgQuery(
    `INSERT INTO "Booking" (id, "guestName", "propertyId", "userId", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [id, guestName, propertyId, session.user.id, checkIn, checkOut, channel, totalPrice, status]
  );

  const created = await pgQueryOne(`SELECT * FROM "Booking" WHERE id = $1 AND "userId" = $2`, [id, session.user.id]);
  return NextResponse.json(created, { status: 201 });
}
