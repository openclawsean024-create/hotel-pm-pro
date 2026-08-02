// app/api/auth/register/route.ts — Register endpoint (用 pg 繞過 Prisma prepared statement)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "密碼至少 6 個字元"),
  name: z.string().min(1, "請填寫姓名").max(50),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "驗證失敗" },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // 檢查 email 是否已存在
    const existing = await pgQueryOne<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (existing) {
      return NextResponse.json(
        { error: "此 email 已被註冊" },
        { status: 409 }
      );
    }

    // 建立 user + subscription
    const passwordHash = await bcrypt.hash(password, 10);
    const cuid = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

    await pgQuery(
      `INSERT INTO "User" (id, email, name, "passwordHash", tier, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'free', NOW(), NOW())`,
      [cuid, email, name, passwordHash]
    );

    await pgQuery(
      `INSERT INTO "Subscription" (id, "userId", plan, status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'free', 'active', NOW(), NOW())`,
      [cuid]
    );

    return NextResponse.json(
      { id: cuid, email, name },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "註冊失敗" }, { status: 500 });
  }
}
