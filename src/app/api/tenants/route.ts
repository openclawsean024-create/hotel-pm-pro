// app/api/tenants/route.ts — Tenants CRUD (F-M2 房客 CRM)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(100),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("")),
  startDate: z.string().min(1), // ISO date string
  endDate: z.string().optional().or(z.literal("")),
  monthlyRent: z.number().int().min(0),
  deposit: z.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  let query = `SELECT id, name, phone, email, "propertyId", "startDate", "endDate", "monthlyRent", deposit, status, "createdAt"
               FROM "Tenant"
               WHERE "userId" = $1`;
  const params: any[] = [session.user.id];

  if (propertyId) {
    query += ` AND "propertyId" = $2`;
    params.push(propertyId);
  }
  query += ` ORDER BY "createdAt" DESC`;

  const tenants = await pgQuery(query, params);
  return NextResponse.json({ tenants });
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
    `SELECT id FROM "Property" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [parsed.data.propertyId, session.user.id]
  );
  if (!prop) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { propertyId, name, phone, email, startDate, endDate, monthlyRent, deposit } = parsed.data;

  await pgQuery(
    `INSERT INTO "Tenant" (id, name, phone, email, "propertyId", "userId", "startDate", "endDate", "monthlyRent", deposit, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW())`,
    [
      id, name, phone, email || null, propertyId, session.user.id,
      startDate, endDate || null, monthlyRent, deposit,
    ]
  );

  const created = await pgQueryOne(
    `SELECT * FROM "Tenant" WHERE id = $1`,
    [id]
  );

  return NextResponse.json(created, { status: 201 });
}
