// app/api/maintenance/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, actualCost, endDate, completedAt, notes } = body;

  const m = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM "Maintenance" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!m || m.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到維修單" }, { status: 404 });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    values.push(status);
  }
  if (actualCost !== undefined) {
    updates.push(`"actualCost" = $${idx++}`);
    values.push(actualCost);
  }
  if (endDate !== undefined) {
    updates.push(`"endDate" = $${idx++}`);
    values.push(endDate);
  }
  if (completedAt !== undefined) {
    updates.push(`"completedAt" = $${idx++}`);
    values.push(completedAt);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${idx++}`);
    values.push(notes);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "無更新內容" }, { status: 400 });
  }

  updates.push(`"updatedAt" = NOW()`);
  values.push(id);

  await pgQuery(
    `UPDATE "Maintenance" SET ${updates.join(", ")} WHERE id = $${idx}`,
    values
  );

  const updated = await pgQueryOne(`SELECT * FROM "Maintenance" WHERE id = $1`, [id]);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const m = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM "Maintenance" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!m || m.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到維修單" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM "Maintenance" WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
