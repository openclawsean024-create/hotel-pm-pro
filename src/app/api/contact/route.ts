// app/api/contact/route.ts (用 pg)
import { NextResponse } from "next/server";
import { z } from "zod";
import { pgQuery } from "@/lib/pg-client";

const schema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  subject: z.string().min(1).max(100),
  message: z.string().min(10).max(2000),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "驗證失敗" }, { status: 400 });
    }

    await pgQuery(
      `INSERT INTO "ContactMessage" (id, name, email, subject, message, status, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'new', NOW())`,
      [parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact error:", err);
    return NextResponse.json({ error: "送出失敗" }, { status: 500 });
  }
}
