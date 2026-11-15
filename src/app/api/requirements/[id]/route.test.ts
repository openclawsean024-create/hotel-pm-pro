// AC-009 需求單無法編輯的回歸測試（PATCH /api/requirements/[id]，FR-014）
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, jsonRequest, mockSession, routeParams, TEST_USER } from "@/test-utils/mock-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn() }));

import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import * as route from "./route";

const URL_ = "http://localhost/api/requirements/req-1";

const EXISTING = {
  id: "req-1",
  userId: TEST_USER.id,
  propertyId: "p1",
  category: "repair",
  title: "測試需求A",
  description: "測試描述",
  priority: "normal",
  status: "open",
  notes: null,
};

function db(existing: typeof EXISTING | null = EXISTING) {
  return installSqlRouter(pg, [
    { match: /^\s*UPDATE "Requirement"/, rows: [] },
    { match: /^\s*DELETE FROM "Requirement"/, rows: [] },
    { match: /FROM "Requirement"/, rows: existing ? [existing] : [] },
  ]);
}

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const PATCH = (route as unknown as { PATCH?: Handler }).PATCH;

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(auth, TEST_USER);
});

describe("AC-009 需求單可以編輯（PATCH）", () => {
  it("AC-009 route 匯出 PATCH", () => {
    expect(typeof PATCH).toBe("function");
  });

  it("AC-009 更新標題、描述、優先級", async () => {
    const router = db();
    const res = await PATCH!(
      jsonRequest(URL_, "PATCH", { title: "測試需求A（已修改）", description: "新的描述", priority: "urgent" }),
      routeParams("req-1"),
    );
    expect(res.status).toBe(200);
    const update = router.find(/^\s*UPDATE "Requirement"/)[0];
    expect(update.sql).toMatch(/title = \$1/);
    expect(update.sql).toMatch(/description = \$2/);
    expect(update.sql).toMatch(/priority = \$3/);
    expect(update.sql).toMatch(/"updatedAt" = NOW\(\)/);
    expect(update.params).toEqual(["測試需求A（已修改）", "新的描述", "urgent", "req-1", TEST_USER.id]);
  });

  it("AC-009 更新狀態為 in_progress", async () => {
    const router = db();
    const res = await PATCH!(jsonRequest(URL_, "PATCH", { status: "in_progress" }), routeParams("req-1"));
    expect(res.status).toBe(200);
    const update = router.find(/^\s*UPDATE "Requirement"/)[0];
    expect(update.sql).toMatch(/status = \$1/);
    expect(update.sql).not.toMatch(/"resolvedAt" = NOW\(\)/);
    expect(update.params).toEqual(["in_progress", "req-1", TEST_USER.id]);
  });

  it("AC-009 狀態改為 resolved 時記錄 resolvedAt；改回 open 時清除", async () => {
    let router = db();
    await PATCH!(jsonRequest(URL_, "PATCH", { status: "resolved" }), routeParams("req-1"));
    expect(router.find(/^\s*UPDATE "Requirement"/)[0].sql).toMatch(/"resolvedAt" = NOW\(\)/);

    vi.clearAllMocks();
    mockSession(auth, TEST_USER);
    router = db({ ...EXISTING, status: "resolved" });
    await PATCH!(jsonRequest(URL_, "PATCH", { status: "open" }), routeParams("req-1"));
    expect(router.find(/^\s*UPDATE "Requirement"/)[0].sql).toMatch(/"resolvedAt" = NULL/);
  });

  it("AC-009 UPDATE 以 id 與 userId 同時限定（多租戶隔離）", async () => {
    const router = db();
    await PATCH!(jsonRequest(URL_, "PATCH", { notes: "測試備註" }), routeParams("req-1"));
    const update = router.find(/^\s*UPDATE "Requirement"/)[0];
    expect(update.sql).toMatch(/WHERE id = \$\d+ AND "userId" = \$\d+/);
    expect(update.params.slice(-2)).toEqual(["req-1", TEST_USER.id]);
  });

  it("AC-009 別人的需求單回 404，且不會執行 UPDATE", async () => {
    const router = db({ ...EXISTING, userId: "user-other" });
    const res = await PATCH!(jsonRequest(URL_, "PATCH", { title: "入侵" }), routeParams("req-1"));
    expect(res.status).toBe(404);
    expect(router.find(/^\s*UPDATE/)).toHaveLength(0);
  });

  it("AC-009 不存在的需求單回 404", async () => {
    db(null);
    const res = await PATCH!(jsonRequest(URL_, "PATCH", { title: "x" }), routeParams("req-x"));
    expect(res.status).toBe(404);
  });

  it("AC-009 未登入回 401", async () => {
    mockSession(auth, null);
    const router = db();
    const res = await PATCH!(jsonRequest(URL_, "PATCH", { title: "x" }), routeParams("req-1"));
    expect(res.status).toBe(401);
    expect(router.calls).toHaveLength(0);
  });

  it("AC-009 無效的狀態、優先級、類別回 400", async () => {
    const router = db();
    for (const body of [{ status: "done" }, { priority: "asap" }, { category: "misc" }, { title: "" }]) {
      const res = await PATCH!(jsonRequest(URL_, "PATCH", body), routeParams("req-1"));
      expect(res.status).toBe(400);
    }
    expect(router.find(/^\s*UPDATE/)).toHaveLength(0);
  });

  it("AC-009 沒有任何可更新欄位回 400", async () => {
    db();
    const res = await PATCH!(jsonRequest(URL_, "PATCH", {}), routeParams("req-1"));
    expect(res.status).toBe(400);
  });

  it("AC-009 不允許改 userId、propertyId 等未開放的欄位", async () => {
    const router = db();
    const res = await PATCH!(
      jsonRequest(URL_, "PATCH", { userId: "user-other", propertyId: "p-other", title: "測試需求B" }),
      routeParams("req-1"),
    );
    expect(res.status).toBe(200);
    const update = router.find(/^\s*UPDATE "Requirement"/)[0];
    expect(update.sql).not.toMatch(/"userId" = \$1|"propertyId"/);
    expect(update.params).toEqual(["測試需求B", "req-1", TEST_USER.id]);
  });

  it("AC-009 JSON 格式錯誤回 400", async () => {
    db();
    const res = await PATCH!(
      new Request(URL_, { method: "PATCH", body: "{not json", headers: { "content-type": "application/json" } }),
      routeParams("req-1"),
    );
    expect(res.status).toBe(400);
  });
});

describe("AC-009 需求單刪除仍以擁有者限定", () => {
  it("AC-009 別人的需求單不能刪除", async () => {
    const router = db({ ...EXISTING, userId: "user-other" });
    const res = await route.DELETE(new Request(URL_, { method: "DELETE" }), routeParams("req-1"));
    expect(res.status).toBe(404);
    expect(router.find(/^\s*DELETE/)).toHaveLength(0);
  });
});
