// app/api/maintenance/route.ts — F-M5 維修派工 CRUD
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const createSchema = z.object({
  propertyId: z.string().min(1),
  requirementId: z.string().optional().or(z.literal("")),
  vendorName: z.string().min(1),
  vendorPhone: z.string().optional().or(z.literal("")),
  vendorEmail: z.string().email().optional().or(z.literal("")),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  estimatedCost: z.number().int().min(0).default(0),
  startDate: z.string().min(1),
  endDate: z.string().optional().or(z.literal("")),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const status = searchParams.get("status");

  let query = `SELECT id, "userId", "propertyId", "requirementId", "vendorName", "vendorPhone", "vendorEmail", title, description, "estimatedCost", "actualCost", "startDate", "endDate", "completedAt", status, notes, "createdAt" FROM "Maintenance" WHERE "userId" = $1`;
  const params: any[] = [session.user.id];

  if (propertyId) {
    query += ` AND "propertyId" = $2`;
    params.push(propertyId);
  }
  if (status) {
    query += ` AND status = $3`;
    params.push(status);
  }
  query += ` ORDER BY "createdAt" DESC`;

  const maintenances = await pgQuery(query, params);
  return NextResponse.json({ maintenances });
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

  const id = `main-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { propertyId, requirementId, vendorName, vendorPhone, vendorEmail, title, description, estimatedCost, startDate, endDate } = parsed.data;

  await pgQuery(
    `INSERT INTO "Maintenance" (id, "userId", "propertyId", "requirementId", "vendorName", "vendorPhone", "vendorEmail", title, description, "estimatedCost", "actualCost", "startDate", "endDate", "completedAt", status, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, NULL, 'pending', NULL, NOW(), NOW())`,
    [
      id, session.user.id, propertyId, requirementId || null, vendorName,
      vendorPhone || null, vendorEmail || null, title, description, estimatedCost,
      startDate, endDate || null,
    ]
  );

  const created = await pgQueryOne(`SELECT * FROM "Maintenance" WHERE id = $1`, [id]);
  return NextResponse.json(created, { status: 201 });
}
