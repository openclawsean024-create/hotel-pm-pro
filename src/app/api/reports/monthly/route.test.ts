// AC-003 月報 API 測試：收入規則、Asia/Taipei 月份邊界、多物業加總、CSV 匯出。
// 「排除已取消訂房」案例來源：hotel-pm `domain.test.ts`「月報表排除已取消訂房」（合併清單 #7）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, mockSession, TEST_USER } from "@/test-utils/mock-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn() }));

import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import { GET } from "./route";

type Prop = { id: string; name: string; monthlyRent: number; ownerShare: number };
type Booking = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: Date | string;
  checkOut: Date | string;
  channel: string;
  totalPrice: number;
  status: string;
};

const P1: Prop = { id: "p1", name: "測試物業A", monthlyRent: 30000, ownerShare: 70 };
const P2: Prop = { id: "p2", name: "測試物業B", monthlyRent: 0, ownerShare: 80 };

const booking = (over: Partial<Booking>): Booking => ({
  id: "b1",
  propertyId: "p1",
  guestName: "測試旅客A",
  checkIn: new Date("2026-07-10T00:00:00Z"),
  checkOut: new Date("2026-07-12T00:00:00Z"),
  channel: "manual",
  totalPrice: 6000,
  status: "completed",
  ...over,
});

function db(properties: Prop[], bookings: Booking[]) {
  return installSqlRouter(pg, [
    { match: /FROM "Property"/, rows: properties },
    { match: /FROM "Booking"/, rows: bookings },
  ]);
}

const get = (query: string) => GET(new Request(`http://localhost/api/reports/monthly${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(auth, TEST_USER);
});

describe("AC-003 月報 API：驗證與存取控制", () => {
  it("AC-003 未登入回 401，且不查資料庫", async () => {
    mockSession(auth, null);
    const router = db([P1], []);
    const res = await get("?month=2026-07");
    expect(res.status).toBe(401);
    expect(router.calls).toHaveLength(0);
  });

  it("AC-003 month 缺少或格式錯誤回 400", async () => {
    db([P1], []);
    for (const q of ["", "?month=2026-7", "?month=2026-13", "?month=2026-00", "?month=202607", "?month=abc"]) {
      expect((await get(q)).status).toBe(400);
    }
  });

  it("AC-003 不支援的 format 回 400", async () => {
    db([P1], []);
    expect((await get("?month=2026-07&format=pdf")).status).toBe(400);
  });

  it("AC-003 兩個查詢都以 userId 限定（多租戶隔離）", async () => {
    const router = db([P1], []);
    await get("?month=2026-07");
    expect(router.calls).toHaveLength(2);
    for (const call of router.calls) {
      expect(call.sql).toMatch(/"userId" = \$1/);
      expect(call.params[0]).toBe(TEST_USER.id);
    }
  });
});

describe("AC-003 月份邊界（Asia/Taipei）", () => {
  it("AC-003 2026-07 的查詢區間是 [2026-06-30T16:00Z, 2026-07-31T16:00Z)", async () => {
    const router = db([P1], []);
    await get("?month=2026-07");
    const q = router.find(/FROM "Booking"/)[0];
    expect(q.sql).toMatch(/"checkIn" >= \$2/);
    expect(q.sql).toMatch(/"checkIn" < \$3/);
    expect(q.params).toEqual([TEST_USER.id, "2026-06-30T16:00:00.000Z", "2026-07-31T16:00:00.000Z"]);
  });

  it("AC-003 12 月的區間結束在隔年 1 月", async () => {
    const router = db([P1], []);
    await get("?month=2026-12");
    expect(router.find(/FROM "Booking"/)[0].params).toEqual([
      TEST_USER.id,
      "2026-11-30T16:00:00.000Z",
      "2026-12-31T16:00:00.000Z",
    ]);
  });

  it("AC-003 台北 7/1 00:00 入住算 7 月；前一秒算 6 月；台北 8/1 00:00 入住算 8 月", async () => {
    const rows = [
      booking({ id: "edge-in", checkIn: "2026-06-30T16:00:00.000Z", checkOut: "2026-07-02T00:00:00.000Z", totalPrice: 1000 }),
      booking({ id: "edge-before", checkIn: "2026-06-30T15:59:59.000Z", checkOut: "2026-07-02T00:00:00.000Z", totalPrice: 2000 }),
      booking({ id: "edge-after", checkIn: "2026-07-31T16:00:00.000Z", checkOut: "2026-08-02T00:00:00.000Z", totalPrice: 4000 }),
    ];
    db([{ ...P1, monthlyRent: 0 }], rows);
    const july = await (await get("?month=2026-07")).json();
    expect(july.properties[0].bookings.map((b: { id: string }) => b.id)).toEqual(["edge-in"]);
    expect(july.properties[0].bookingRevenue).toBe(1000);

    const june = await (await get("?month=2026-06")).json();
    expect(june.properties[0].bookings.map((b: { id: string }) => b.id)).toEqual(["edge-before"]);

    const august = await (await get("?month=2026-08")).json();
    expect(august.properties[0].bookings.map((b: { id: string }) => b.id)).toEqual(["edge-after"]);
  });

  it("AC-003 跨月訂房整筆算在入住月，不重複計入下個月", async () => {
    const crossMonth = booking({
      id: "cross",
      checkIn: new Date("2026-07-30T00:00:00Z"),
      checkOut: new Date("2026-08-02T00:00:00Z"),
      totalPrice: 9000,
    });
    db([{ ...P1, monthlyRent: 0 }], [crossMonth]);

    const july = await (await get("?month=2026-07")).json();
    expect(july.properties[0]).toMatchObject({ bookingRevenue: 9000, bookingCount: 1, totalIncome: 9000 });
    expect(july.properties[0].bookings[0]).toMatchObject({ checkIn: "2026-07-30", checkOut: "2026-08-02" });

    const august = await (await get("?month=2026-08")).json();
    expect(august.properties[0]).toMatchObject({ bookingRevenue: 0, bookingCount: 0, totalIncome: 0 });
  });
});

describe("AC-003 收入規則：月租 + 當月 completed 訂房，排除 cancelled", () => {
  it("AC-003 SQL 只取 completed 的訂房", async () => {
    const router = db([P1], []);
    await get("?month=2026-07");
    expect(router.find(/FROM "Booking"/)[0].sql).toMatch(/status = 'completed'/);
  });

  it("AC-003 已取消的訂房不計入收入與筆數（搬自 hotel-pm）", async () => {
    const cancelled = booking({ id: "b-cancel", status: "cancelled", totalPrice: 9999 });
    db([{ ...P1, monthlyRent: 0 }], [booking({}), cancelled]);
    const body = await (await get("?month=2026-07")).json();
    expect(body.properties[0].bookingRevenue).toBe(6000);
    expect(body.properties[0].totalIncome).toBe(6000);
    expect(body.properties[0].bookingCount).toBe(1);
  });

  it("AC-003 尚未完成（confirmed）的訂房不計入", async () => {
    db([{ ...P1, monthlyRent: 0 }], [booking({ status: "confirmed", totalPrice: 5000 })]);
    const body = await (await get("?month=2026-07")).json();
    expect(body.properties[0]).toMatchObject({ bookingRevenue: 0, bookingCount: 0 });
  });

  it("AC-003 無訂房時回傳零訂房收入、零筆數（搬自 hotel-pm）", async () => {
    db([{ ...P1, monthlyRent: 0 }], []);
    const body = await (await get("?month=2026-07")).json();
    expect(body.properties[0].totalIncome).toBe(0);
    expect(body.properties[0].bookingCount).toBe(0);
  });

  it("AC-003 單一物業：月租 30000 + 訂房 6000，房東 70% = 25200、業者 10800", async () => {
    db([P1], [booking({})]);
    const body = await (await get("?month=2026-07")).json();
    expect(body.month).toBe("2026-07");
    expect(body.properties[0]).toMatchObject({
      propertyId: "p1",
      propertyName: "測試物業A",
      monthlyRent: 30000,
      ownerSharePercent: 70,
      bookingRevenue: 6000,
      bookingCount: 1,
      totalIncome: 36000,
      ownerShareAmount: 25200,
      operatorShare: 10800,
    });
  });

  it("AC-003 四捨五入：1001 元 × 50% → 房東 501、業者 500", async () => {
    db([{ id: "p9", name: "測試物業C", monthlyRent: 1001, ownerShare: 50 }], []);
    const body = await (await get("?month=2026-07")).json();
    expect(body.properties[0]).toMatchObject({ totalIncome: 1001, ownerShareAmount: 501, operatorShare: 500 });
  });

  it("AC-003 別的物業的訂房不會算到這個物業", async () => {
    db([P1, P2], [booking({ id: "b2", propertyId: "p2", totalPrice: 8000 })]);
    const body = await (await get("?month=2026-07")).json();
    expect(body.properties[0].bookingRevenue).toBe(0);
    expect(body.properties[1].bookingRevenue).toBe(8000);
  });
});

describe("AC-003 無物業與多物業加總", () => {
  it("AC-003 無物業時回空清單與全為 0 的 summary", async () => {
    db([], []);
    const res = await get("?month=2026-07");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      month: "2026-07",
      properties: [],
      summary: { totalRevenue: 0, totalOwnerShare: 0, totalOperatorShare: 0, propertyCount: 0 },
    });
  });

  it("AC-003 多物業加總等於 summary，且房東 + 業者 = 總收入", async () => {
    const props: Prop[] = [
      P1,
      P2,
      { id: "p3", name: "測試物業C", monthlyRent: 12345, ownerShare: 33 },
      { id: "p4", name: "測試物業D", monthlyRent: 999, ownerShare: 0 },
      { id: "p5", name: "測試物業E", monthlyRent: 1, ownerShare: 100 },
    ];
    const rows = [
      booking({ id: "b1", propertyId: "p1", totalPrice: 6001 }),
      booking({ id: "b2", propertyId: "p2", totalPrice: 8333 }),
      booking({ id: "b3", propertyId: "p2", totalPrice: 4444 }),
      booking({ id: "b4", propertyId: "p3", totalPrice: 777 }),
      booking({ id: "b5", propertyId: "p3", status: "cancelled", totalPrice: 50000 }),
    ];
    db(props, rows);
    const body = await (await get("?month=2026-07")).json();
    const sum = (key: string) =>
      body.properties.reduce((s: number, p: Record<string, number>) => s + p[key], 0);

    expect(body.summary.propertyCount).toBe(5);
    expect(body.summary.totalRevenue).toBe(sum("totalIncome"));
    expect(body.summary.totalOwnerShare).toBe(sum("ownerShareAmount"));
    expect(body.summary.totalOperatorShare).toBe(sum("operatorShare"));
    expect(body.summary.totalOwnerShare + body.summary.totalOperatorShare).toBe(body.summary.totalRevenue);
    expect(body.summary.totalRevenue).toBe(30000 + 6001 + 8333 + 4444 + 12345 + 777 + 999 + 1);
    for (const p of body.properties) {
      expect(p.ownerShareAmount + p.operatorShare).toBe(p.totalIncome);
      expect(Number.isInteger(p.ownerShareAmount)).toBe(true);
      expect(Number.isInteger(p.operatorShare)).toBe(true);
    }
  });

  it("AC-003 物業的 ownerShare 超出 0–100 時回 422，不輸出錯誤的帳", async () => {
    db([{ id: "p-bad", name: "測試物業X", monthlyRent: 1000, ownerShare: 150 }], []);
    const res = await get("?month=2026-07");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/測試物業X.*ownerShare 必須是 0~100 的整數/);
  });
});

describe("AC-003 CSV 匯出（?format=csv）", () => {
  it("AC-003 回 text/csv、附檔名與 UTF-8 BOM", async () => {
    db([P1], [booking({})]);
    const res = await get("?month=2026-07&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="monthly-report-2026-07.csv"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("AC-003 CSV 內容：表頭、每物業一列、最後一列合計", async () => {
    db([P1, P2], [booking({}), booking({ id: "b2", propertyId: "p2", totalPrice: 8000 })]);
    const text = (await (await get("?month=2026-07&format=csv")).text()).replace(/^﻿/, "");
    expect(text.split("\n")).toEqual([
      "月份,物業,月租金,訂房筆數,訂房收入,總收入,房東分潤比例(%),房東分潤,業者分潤",
      "2026-07,測試物業A,30000,1,6000,36000,70,25200,10800",
      "2026-07,測試物業B,0,1,8000,8000,80,6400,1600",
      "2026-07,合計,30000,2,14000,44000,,31600,12400",
    ]);
  });

  it("AC-003 CSV 與 JSON 的數字一致", async () => {
    const props = [P1, P2];
    const rows = [booking({ totalPrice: 6001 }), booking({ id: "b2", propertyId: "p2", totalPrice: 8333 })];
    db(props, rows);
    const json = await (await get("?month=2026-07")).json();
    const csv = (await (await get("?month=2026-07&format=csv")).text()).replace(/^﻿/, "");
    const total = csv.split("\n").at(-1)!.split(",");
    expect(Number(total[5])).toBe(json.summary.totalRevenue);
    expect(Number(total[7])).toBe(json.summary.totalOwnerShare);
    expect(Number(total[8])).toBe(json.summary.totalOperatorShare);
  });

  it("AC-003 物業名稱含逗號、雙引號、換行時依 RFC 4180 跳脫", async () => {
    db(
      [
        { id: "p1", name: "測試物業,A棟", monthlyRent: 100, ownerShare: 50 },
        { id: "p2", name: '測試物業"B"', monthlyRent: 100, ownerShare: 50 },
        { id: "p3", name: "測試物業\nC", monthlyRent: 100, ownerShare: 50 },
      ],
      [],
    );
    const text = (await (await get("?month=2026-07&format=csv")).text()).replace(/^﻿/, "");
    expect(text).toContain('2026-07,"測試物業,A棟",100,0,0,100,50,50,50');
    expect(text).toContain('2026-07,"測試物業""B""",100,0,0,100,50,50,50');
    expect(text).toContain('2026-07,"測試物業\nC",100,0,0,100,50,50,50');
  });

  it("AC-003 無物業時 CSV 仍有表頭與合計列", async () => {
    db([], []);
    const text = (await (await get("?month=2026-07&format=csv")).text()).replace(/^﻿/, "");
    expect(text.split("\n")).toEqual([
      "月份,物業,月租金,訂房筆數,訂房收入,總收入,房東分潤比例(%),房東分潤,業者分潤",
      "2026-07,合計,0,0,0,0,,0,0",
    ]);
  });

  it("AC-003 未登入不能下載 CSV", async () => {
    mockSession(auth, null);
    db([P1], []);
    expect((await get("?month=2026-07&format=csv")).status).toBe(401);
  });
});
