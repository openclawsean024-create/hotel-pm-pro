// app/api/requirements/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const req = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM \"Requirement\" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!req || req.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到需求" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM \"Requirement\" WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
