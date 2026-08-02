// app/api/properties/route.ts (用 pg)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
  roomType: z.string().min(1).max(20),
  area: z.number().nullable().optional(),
  monthlyRent: z.number().int().min(0),
  ownerShare: z.number().int().min(0).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const properties = await pgQuery<any>(
    `SELECT id, name, address, "roomType", area, "monthlyRent", "ownerShare",
            "userId", "createdAt", "updatedAt"
     FROM "Property"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC`,
    [session.user.id]
  );

  return NextResponse.json({ properties });
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

  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const { name, address, roomType, area, monthlyRent, ownerShare } = parsed.data;

  await pgQuery(
    `INSERT INTO "Property" (id, name, address, "roomType", area, "monthlyRent", "ownerShare", "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [id, name, address, roomType, area ?? null, monthlyRent, ownerShare, session.user.id]
  );

  const created = await pgQueryOne<any>(
    `SELECT * FROM "Property" WHERE id = $1`,
    [id]
  );

  return NextResponse.json(created, { status: 201 });
}
