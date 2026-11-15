// AC-009 缺陷 1 回歸測試：總覽頁伺服器端預載不得查詢不存在的 "Room" 表，且資料庫錯誤不得被吞掉。
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, TEST_USER } from "@/test-utils/mock-db";

vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn() }));

import * as pg from "@/lib/pg-client";
import { loadDashboardPreload } from "@/lib/dashboard-preload";

const pageSource = readFileSync(path.resolve(__dirname, "../../dashboard/page.tsx"), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AC-009 缺陷 1：總覽頁預載", () => {
  it('AC-009 總覽頁原始碼不再出現 "Room" 資料表', () => {
    expect(pageSource).not.toMatch(/"Room"/);
  });

  it("AC-009 總覽頁使用 loadDashboardPreload，且預載失敗時會記錄錯誤（不是空的 catch）", () => {
    expect(pageSource).toMatch(/loadDashboardPreload\(/);
    expect(pageSource).toMatch(/catch \(err\) \{[\s\S]*console\.error\(/);
    expect(pageSource).not.toMatch(/catch \{\s*\/\/ Demo environment/);
  });

  it("AC-009 預載能取得物業，且所有查詢都不碰 Room 表", async () => {
    const db = installSqlRouter(pg, [
      {
        match: /FROM "Property"/,
        rows: [
          { id: "p1", name: "測試物業A", roomType: "整層", ownerShare: 80 },
          { id: "p2", name: "測試物業B", roomType: "套房", ownerShare: 70 },
        ],
      },
      { match: /FROM "User"/, rows: [{ tier: "pro", name: "測試業者A", email: "demo@hotel-pm.test" }] },
    ]);

    const result = await loadDashboardPreload(TEST_USER.id);

    expect(result.properties).toEqual([
      { id: "p1", name: "測試物業A", roomType: "整層", roomsCount: 1, ownerShare: 80 },
      { id: "p2", name: "測試物業B", roomType: "套房", roomsCount: 1, ownerShare: 70 },
    ]);
    expect(result.user).toEqual({ tier: "pro", name: "測試業者A", email: "demo@hotel-pm.test" });
    expect(db.calls.length).toBeGreaterThan(0);
    for (const call of db.calls) {
      expect(call.sql).not.toMatch(/"Room"/);
    }
  });

  it("AC-009 預載查詢都以 userId 限定（多租戶隔離）", async () => {
    const db = installSqlRouter(pg, []);
    await loadDashboardPreload(TEST_USER.id);
    const propertyQuery = db.find(/FROM "Property"/)[0];
    expect(propertyQuery.sql).toMatch(/"userId" = \$1/);
    expect(propertyQuery.params).toEqual([TEST_USER.id]);
    const userQuery = db.find(/FROM "User"/)[0];
    expect(userQuery.params).toEqual([TEST_USER.id]);
  });

  it("AC-009 沒有物業時回空陣列、找不到使用者時 user 為 null", async () => {
    installSqlRouter(pg, []);
    await expect(loadDashboardPreload(TEST_USER.id)).resolves.toEqual({ properties: [], user: null });
  });

  it("AC-009 資料庫錯誤會往外拋，不會被吞成空清單", async () => {
    installSqlRouter(pg, [
      {
        match: /FROM "Property"/,
        rows: () => {
          throw new Error('relation "Room" does not exist');
        },
      },
    ]);
    await expect(loadDashboardPreload(TEST_USER.id)).rejects.toThrow(/does not exist/);
  });
});
