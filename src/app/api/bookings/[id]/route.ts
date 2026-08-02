// app/api/bookings/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQueryOne, pgQuery } from "@/lib/pg-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const b = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM "Booking" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!b || b.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到訂房" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM "Booking" WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
