// app/api/requirements/route.ts — F-M4 需求記錄 CRUD
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const createSchema = z.object({
  propertyId: z.string().min(1),
  tenantId: z.string().optional().or(z.literal("")),
  bookingId: z.string().optional().or(z.literal("")),
  category: z.enum(["repair", "special_request", "cleaning_note", "other"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const tenantId = searchParams.get("tenantId");
  const bookingId = searchParams.get("bookingId");

  let query = `SELECT id, \"userId\", \"propertyId\", \"tenantId\", \"bookingId\", category, title, description, priority, status, \"createdAt\" FROM \"Requirement\" WHERE \"userId\" = $1`;
  const params: any[] = [session.user.id];

  if (propertyId) {
    query += ` AND \"propertyId\" = $2`;
    params.push(propertyId);
  }
  if (tenantId) {
    query += ` AND \"tenantId\" = $3`;
    params.push(tenantId);
  }
  if (bookingId) {
    query += ` AND \"bookingId\" = $4`;
    params.push(bookingId);
  }
  query += ` ORDER BY \"createdAt\" DESC`;

  const requirements = await pgQuery(query, params);
  return NextResponse.json({ requirements });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "驗證失敗" },
      { status: 400 }
    );
  }

  // 確認 property 屬於此 user
  const prop = await pgQueryOne<{ id: string }>(
    `SELECT id FROM \"Property\" WHERE id = $1 AND \"userId\" = $2 LIMIT 1`,
    [parsed.data.propertyId, session.user.id]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  const id = `req-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { propertyId, tenantId, bookingId, category, title, description, priority } = parsed.data;

  await pgQuery(
    `INSERT INTO \"Requirement\" (id, \"userId\", \"propertyId\", \"tenantId\", \"bookingId\", category, title, description, priority, status, \"createdAt\", \"updatedAt\")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', NOW(), NOW())`,
    [
      id, session.user.id, propertyId, tenantId || null, bookingId || null,
      category, title, description, priority,
    ]
  );

  const created = await pgQueryOne(`SELECT * FROM \"Requirement\" WHERE id = $1`, [id]);
  return NextResponse.json(created, { status: 201 });
}
