// AC-009 總覽 API 回歸測試：缺陷 2（checkout_today 不可達）與入住率改用 getOccupancyRate。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, mockSession, TEST_USER, type SqlRule } from "@/test-utils/mock-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn() }));

import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import { GET } from "./route";

// 台北時間 2026-11-16 12:00（UTC 04:00）
const NOW = new Date("2026-11-16T04:00:00Z");
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const PROPERTIES = [
  { id: "p1", name: "測試物業A", roomType: "整層", monthlyRent: 30000, ownerShare: 80 },
  { id: "p2", name: "測試物業B", roomType: "套房", monthlyRent: 20000, ownerShare: 70 },
];

interface BookingRow {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: Date | string;
  checkOut: Date | string;
  status: string;
  totalPrice: number;
}

function rules(opts: {
  properties?: typeof PROPERTIES;
  bookings?: BookingRow[];
  maintenance?: Array<{ id: string; title: string; propertyId: string }>;
  tenants?: Array<Record<string, unknown>>;
}): SqlRule[] {
  return [
    { match: /FROM "Property"/, rows: opts.properties ?? PROPERTIES },
    { match: /COUNT\(\*\)/, rows: [{ count: "0" }] },
    { match: /SUM\("totalPrice"\)/, rows: [] },
    { match: /FROM "Booking"/, rows: opts.bookings ?? [] },
    { match: /FROM "Tenant"/, rows: opts.tenants ?? [] },
    {
      match: /FROM "Maintenance"[\s\S]*"startDate" <=/,
      rows: (opts.maintenance ?? []).map((m) => ({ ...m })),
    },
  ];
}

async function getSummary(url = "http://localhost/api/dashboard/summary") {
  const res = await GET(new Request(url));
  return { res, body: await res.json() };
}

const roomState = (body: { rooms: Array<{ id: string; state: string }> }, id: string) =>
  body.rooms.find((r) => r.id === id)?.state;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockSession(auth, TEST_USER);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AC-009 缺陷 2：checkout_today 房況", () => {
  it("AC-009 今天退房的物業房況為 checkout_today（資料庫回傳 Date 物件）", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-14"),
            checkOut: utc("2026-11-16"),
            status: "confirmed",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { res, body } = await getSummary();
    expect(res.status).toBe(200);
    expect(roomState(body, "p1")).toBe("checkout_today");
    expect(roomState(body, "p2")).toBe("empty");
  });

  it("AC-009 今天退房（日期為 ISO 字串）同樣判斷為 checkout_today", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: "2026-11-14T00:00:00.000Z",
            checkOut: "2026-11-16T00:00:00.000Z",
            status: "confirmed",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(roomState(body, "p1")).toBe("checkout_today");
  });

  it("AC-009 入住中（今天之後才退房）為 occupied", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-15"),
            checkOut: utc("2026-11-18"),
            status: "confirmed",
            totalPrice: 9000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(roomState(body, "p1")).toBe("occupied");
  });

  it("AC-009 今天入住為 occupied；昨天退房且今天沒人入住為 cleaning", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-16"),
            checkOut: utc("2026-11-18"),
            status: "confirmed",
            totalPrice: 6000,
          },
          {
            id: "b2",
            propertyId: "p2",
            guestName: "測試旅客B",
            checkIn: utc("2026-11-13"),
            checkOut: utc("2026-11-15"),
            status: "completed",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(roomState(body, "p1")).toBe("occupied");
    expect(roomState(body, "p2")).toBe("cleaning");
  });

  it("AC-009 維修中的物業優先顯示 maintenance", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-14"),
            checkOut: utc("2026-11-16"),
            status: "confirmed",
            totalPrice: 6000,
          },
        ],
        maintenance: [{ id: "m1", title: "測試維修A", propertyId: "p1" }],
      }),
    );
    const { body } = await getSummary();
    expect(roomState(body, "p1")).toBe("maintenance");
  });

  it("AC-009 已取消的訂房不影響房況", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-14"),
            checkOut: utc("2026-11-16"),
            status: "cancelled",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(roomState(body, "p1")).toBe("empty");
  });

  it("AC-009 今天退房會出現在今日時間軸", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-14"),
            checkOut: utc("2026-11-16"),
            status: "confirmed",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(body.timeline).toContainEqual(
      expect.objectContaining({ type: "checkout", propertyId: "p1", meta: "測試旅客A · 測試物業A" }),
    );
  });
});

describe("AC-009 入住率改用 getOccupancyRate", () => {
  it("AC-009 今晚入住率：2 個物業其中 1 個今晚有人住 → 50%；今天退房不算今晚入住", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-15"),
            checkOut: utc("2026-11-18"),
            status: "confirmed",
            totalPrice: 9000,
          },
          {
            id: "b2",
            propertyId: "p2",
            guestName: "測試旅客B",
            checkIn: utc("2026-11-14"),
            checkOut: utc("2026-11-16"),
            status: "confirmed",
            totalPrice: 6000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    expect(body.occupancy.rate).toBe(50);
    expect(body.occupancy.occupied).toBe(2); // 房況：occupied + checkout_today
  });

  it("AC-009 物業表現的入住率 = 當月已售晚數 ÷ 當月天數（11 月 30 天）", async () => {
    installSqlRouter(
      pg,
      rules({
        bookings: [
          {
            id: "b1",
            propertyId: "p1",
            guestName: "測試旅客A",
            checkIn: utc("2026-11-01"),
            checkOut: utc("2026-11-16"), // 15 晚
            status: "completed",
            totalPrice: 45000,
          },
          {
            id: "b2",
            propertyId: "p2",
            guestName: "測試旅客B",
            checkIn: utc("2026-10-30"),
            checkOut: utc("2026-11-04"), // 跨月：只算 11/1–11/3 共 3 晚
            status: "completed",
            totalPrice: 15000,
          },
          {
            id: "b3",
            propertyId: "p2",
            guestName: "測試旅客C",
            checkIn: utc("2026-11-10"),
            checkOut: utc("2026-11-20"),
            status: "cancelled",
            totalPrice: 30000,
          },
        ],
      }),
    );
    const { body } = await getSummary();
    const perf = Object.fromEntries(
      (body.propertyPerformance as Array<{ id: string; occupancy: number }>).map((p) => [p.id, p.occupancy]),
    );
    expect(perf.p1).toBe(50);
    expect(perf.p2).toBe(10);
  });

  it("AC-009 沒有訂房時入住率為 0", async () => {
    installSqlRouter(pg, rules({}));
    const { body } = await getSummary();
    expect(body.occupancy.rate).toBe(0);
    expect(body.propertyPerformance.every((p: { occupancy: number }) => p.occupancy === 0)).toBe(true);
  });
});

describe("AC-009 總覽 API 基本行為", () => {
  it("AC-009 未登入回 401，且不查資料庫", async () => {
    mockSession(auth, null);
    const db = installSqlRouter(pg, rules({}));
    const { res } = await getSummary();
    expect(res.status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it("AC-009 month 格式錯誤回 400", async () => {
    installSqlRouter(pg, rules({}));
    const { res } = await getSummary("http://localhost/api/dashboard/summary?month=2026-7");
    expect(res.status).toBe(400);
  });

  it("AC-009 沒有物業時回空的總覽", async () => {
    installSqlRouter(pg, rules({ properties: [] }));
    const { res, body } = await getSummary();
    expect(res.status).toBe(200);
    expect(body.rooms).toEqual([]);
    expect(body.occupancy.rate).toBe(0);
  });

  it("AC-009 所有查詢都以 userId 限定（多租戶隔離）", async () => {
    const db = installSqlRouter(pg, rules({}));
    await getSummary();
    expect(db.calls.length).toBeGreaterThan(0);
    for (const call of db.calls) {
      expect(call.sql).toMatch(/"userId" = \$1/);
      expect(call.params[0]).toBe(TEST_USER.id);
    }
  });
});

describe("AC-004 總覽提醒區：合約到期／逾期（contractAlerts）", () => {
  const tenants = [
    { id: "t1", name: "測試房客A", propertyId: "p1", endDate: utc("2026-11-30"), status: "active" },
    { id: "t2", name: "測試房客B", propertyId: "p2", endDate: utc("2026-11-01"), status: "active" },
    { id: "t3", name: "測試房客C", propertyId: "p1", endDate: utc("2026-11-16"), status: "active" },
  ];

  it("AC-004 回傳 30 天內到期與已逾期的房客，含房客與物業名稱", async () => {
    installSqlRouter(pg, rules({ tenants }));
    const { body } = await getSummary();
    expect(body.contractAlerts).toEqual([
      {
        tenantId: "t1",
        message: "合約將於 14 天內到期",
        severity: "warning",
        tenantName: "測試房客A",
        propertyId: "p1",
        propertyName: "測試物業A",
        endDate: "2026-11-30",
      },
      {
        tenantId: "t2",
        message: "合約已逾期 15 天",
        severity: "danger",
        tenantName: "測試房客B",
        propertyId: "p2",
        propertyName: "測試物業B",
        endDate: "2026-11-01",
      },
      {
        tenantId: "t3",
        message: "合約今天到期",
        severity: "warning",
        tenantName: "測試房客C",
        propertyId: "p1",
        propertyName: "測試物業A",
        endDate: "2026-11-16",
      },
    ]);
  });

  it("AC-004 查詢只取自己的、租賃中、有 endDate 且在提醒範圍內的房客", async () => {
    const db = installSqlRouter(pg, rules({ tenants: [] }));
    await getSummary();
    const q = db.find(/FROM "Tenant"/)[0];
    expect(q.sql).toMatch(/"userId" = \$1/);
    expect(q.sql).toMatch(/status = 'active'/);
    expect(q.sql).toMatch(/"endDate" IS NOT NULL/);
    expect(q.params).toEqual([TEST_USER.id, ["p1", "p2"], "2026-12-18"]);
  });

  it("AC-004 沒有需要提醒的房客時回空陣列；沒有物業時也回空陣列", async () => {
    installSqlRouter(pg, rules({ tenants: [] }));
    expect((await getSummary()).body.contractAlerts).toEqual([]);
    installSqlRouter(pg, rules({ properties: [], tenants }));
    expect((await getSummary()).body.contractAlerts).toEqual([]);
  });

  it("AC-004 超過 30 天才到期的房客即使被查出來也不提醒", async () => {
    installSqlRouter(
      pg,
      rules({ tenants: [{ id: "t9", name: "測試房客D", propertyId: "p1", endDate: utc("2026-12-17"), status: "active" }] }),
    );
    expect((await getSummary()).body.contractAlerts).toEqual([]);
  });
});
