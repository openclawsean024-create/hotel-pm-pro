// lib/dashboard-preload.ts — 營運總覽頁的伺服器端預載（AC-009 缺陷 1，FR-020）
//
// 舊版在 app/dashboard/page.tsx 內查詢不存在的 "Room" 資料表，錯誤又被空的 catch 吞掉，
// 導致預載的物業清單永遠是空的。主 repo 目前沒有房間／單位模型（FR-005 排在 M2），
// 所以每個物業視為 1 個可售單位（roomsCount = 1）。
// 這個函式不吞錯誤；由呼叫端決定如何記錄與呈現。
import { pgQuery } from "@/lib/pg-client";

export interface DashboardPreloadProperty {
  id: string;
  name: string;
  roomType: string;
  roomsCount: number;
  /** 0–100 整數百分比 */
  ownerShare: number | null;
}

export interface DashboardPreloadUser {
  tier: string | null;
  name: string | null;
  email: string | null;
}

export interface DashboardPreload {
  properties: DashboardPreloadProperty[];
  user: DashboardPreloadUser | null;
}

export async function loadDashboardPreload(userId: string): Promise<DashboardPreload> {
  const [properties, users] = await Promise.all([
    pgQuery<{ id: string; name: string; roomType: string; ownerShare: number | null }>(
      `SELECT p.id,
              p.name,
              p."roomType" AS "roomType",
              p."ownerShare" AS "ownerShare"
         FROM "Property" p
        WHERE p."userId" = $1
        ORDER BY p.name ASC
        LIMIT 200`,
      [userId],
    ),
    pgQuery<DashboardPreloadUser>(`SELECT tier, name, email FROM "User" WHERE id = $1 LIMIT 1`, [userId]),
  ]);

  return {
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      roomType: p.roomType,
      roomsCount: 1,
      ownerShare: p.ownerShare,
    })),
    user: users[0] ?? null,
  };
}
