// app/api/requirements/[id]/route.ts — 需求單編輯與刪除（FR-014）
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

// 可編輯的欄位。userId／propertyId 等其他欄位不開放修改（未列出的 key 會被 Zod 丟棄）。
const updateSchema = z.object({
  title: z.string().trim().min(1, "標題不可空白").max(200).optional(),
  description: z.string().trim().min(1, "描述不可空白").optional(),
  category: z.enum(["repair", "special_request", "cleaning_note", "other"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const UPDATABLE_COLUMNS = ["title", "description", "category", "priority", "status", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON 內容" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "驗證失敗" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const column of UPDATABLE_COLUMNS) {
    const value = parsed.data[column];
    if (value !== undefined) {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: "無更新內容" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await pgQueryOne<{ userId: string; status: string }>(
    `SELECT "userId", status FROM "Requirement" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到需求" }, { status: 404 });
  }

  // 狀態變成已解決／已結案時記錄 resolvedAt；改回處理中則清除。
  const nextStatus = parsed.data.status;
  if (nextStatus !== undefined) {
    const nowResolved = nextStatus === "resolved" || nextStatus === "closed";
    const wasResolved = existing.status === "resolved" || existing.status === "closed";
    if (nowResolved && !wasResolved) updates.push(`"resolvedAt" = NOW()`);
    if (!nowResolved) updates.push(`"resolvedAt" = NULL`);
  }
  updates.push(`"updatedAt" = NOW()`);

  values.push(id, session.user.id);
  await pgQuery(
    `UPDATE "Requirement" SET ${updates.join(", ")} WHERE id = $${values.length - 1} AND "userId" = $${values.length}`,
    values
  );

  const updated = await pgQueryOne(
    `SELECT id, "userId", "propertyId", "tenantId", "bookingId", category, title, description, priority, status, notes, "resolvedAt", "createdAt", "updatedAt"
       FROM "Requirement" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
    [id, session.user.id]
  );
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const req = await pgQueryOne<{ userId: string }>(
    `SELECT "userId" FROM "Requirement" WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!req || req.userId !== session.user.id) {
    return NextResponse.json({ error: "找不到需求" }, { status: 404 });
  }

  await pgQuery(`DELETE FROM "Requirement" WHERE id = $1 AND "userId" = $2`, [id, session.user.id]);
  return NextResponse.json({ ok: true });
}
