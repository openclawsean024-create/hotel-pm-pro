// app/api/tenants/[id]/route.ts — Tenant delete
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQueryOne, pgQuery } from "@/lib/pg-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;

  const tenant = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM "Tenant" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!tenant || tenant.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到房客" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM "Tenant" WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
