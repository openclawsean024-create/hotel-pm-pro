// app/api/bookings/route.ts — Bookings CRUD (F-M3 訂房看板)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

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
  const params: any[] = [session.user.id];

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

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "驗證失敗" }, { status: 400 });
  }

  const prop = await pgQueryOne<{ id: string }>(
    `SELECT id FROM "Property" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [parsed.data.propertyId, session.user.id]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { propertyId, guestName, checkIn, checkOut, channel, totalPrice, status } = parsed.data;

  await pgQuery(
    `INSERT INTO "Booking" (id, "guestName", "propertyId", "userId", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [id, guestName, propertyId, session.user.id, checkIn, checkOut, channel, totalPrice, status]
  );

  const created = await pgQueryOne(`SELECT * FROM "Booking" WHERE id = $1`, [id]);
  return NextResponse.json(created, { status: 201 });
}
