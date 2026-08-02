// app/api/properties/[id]/route.ts (用 pg)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQueryOne, pgQuery } from "@/lib/pg-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;

  // 確認擁有權
  const property = await pgQueryOne<any>(
    `SELECT id, "userId" FROM "Property" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!property || property.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到物業" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM "Property" WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
