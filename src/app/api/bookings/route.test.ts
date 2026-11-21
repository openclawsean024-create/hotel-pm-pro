// AC-005 訂房 API 測試：重疊回 409、日期規則回 400、相鄰不算重疊。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, installTransactionPassthrough, jsonRequest, mockSession, TEST_USER } from "@/test-utils/mock-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn(), withTransaction: vi.fn() }));

import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import { GET, POST } from "./route";

const URL_ = "http://localhost/api/bookings";

type Existing = { id: string; guestName: string; checkIn: Date; checkOut: Date; status: string };

const existing = (over: Partial<Existing> = {}): Existing => ({
  id: "b-existing",
  guestName: "測試旅客A",
  checkIn: new Date("2026-07-10T00:00:00Z"),
  checkOut: new Date("2026-07-12T00:00:00Z"),
  status: "confirmed",
  ...over,
});

let transactions: number;
let rolledBack: number;

function db(opts: { ownsProperty?: boolean; existing?: Existing[] } = {}) {
  transactions = 0;
  rolledBack = 0;
  installTransactionPassthrough(
    pg,
    () => (rolledBack += 1),
    () => (transactions += 1),
  );
  return installSqlRouter(pg, [
    { match: /FROM "Property"/, rows: opts.ownsProperty === false ? [] : [{ id: "p1" }] },
    { match: /^\s*INSERT INTO "Booking"/, rows: [] },
    { match: /SELECT \* FROM "Booking"/, rows: [{ id: "new-booking", propertyId: "p1" }] },
    { match: /FROM "Booking"/, rows: opts.existing ?? [] },
  ]);
}

const newBooking = (over: Record<string, unknown> = {}) => ({
  propertyId: "p1",
  guestName: "測試旅客B",
  checkIn: "2026-07-11",
  checkOut: "2026-07-13",
  channel: "manual",
  totalPrice: 6000,
  ...over,
});

const post = (body: unknown) => POST(jsonRequest(URL_, "POST", body));
const inserts = (router: ReturnType<typeof db>) => router.find(/^\s*INSERT INTO "Booking"/);

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(auth, TEST_USER);
});

describe("AC-005 POST /api/bookings：同時送出的訂房不會都通過檢查", () => {
  it("AC-005 先取得這個物業的鎖，再在同一個交易裡檢查重疊與寫入", async () => {
    const router = db();
    const res = await post(newBooking());
    expect(res.status).toBe(201);
    expect(transactions).toBe(1);
    const order = router.calls.map((c) => c.sql.replace(/\s+/g, " ").trim());
    const lock = order.findIndex((q) => /pg_advisory_xact_lock/.test(q));
    const check = order.findIndex((q) => /"checkIn" < \$3/.test(q));
    const insert = order.findIndex((q) => /^INSERT INTO "Booking"/.test(q));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(check);
    expect(check).toBeLessThan(insert);
    expect(router.calls[lock].params).toEqual(["p1"]);
  });

  it("AC-005 重疊時不寫入（交易內直接結束，不留下半筆資料）", async () => {
    const router = db({ existing: [existing()] });
    const res = await post(newBooking());
    expect(res.status).toBe(409);
    expect(inserts(router)).toHaveLength(0);
    expect(transactions).toBe(1);
  });
});

describe("AC-005 POST /api/bookings：重疊檢查", () => {
  it("AC-005 與同一物業未取消的訂房重疊回 409，且不寫入", async () => {
    const router = db({ existing: [existing()] });
    const res = await post(newBooking());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/已有訂房/);
    expect(body.conflicts).toEqual([{ id: "b-existing", checkIn: "2026-07-10", checkOut: "2026-07-12" }]);
    expect(inserts(router)).toHaveLength(0);
  });

  it("AC-005 相鄰（既有退房日 = 新訂房入住日）不算重疊，回 201", async () => {
    const router = db({ existing: [existing()] });
    const res = await post(newBooking({ checkIn: "2026-07-12", checkOut: "2026-07-14" }));
    expect(res.status).toBe(201);
    expect(inserts(router)).toHaveLength(1);
  });

  it("AC-005 相鄰（新訂房退房日 = 既有入住日）不算重疊，回 201", async () => {
    const router = db({ existing: [existing()] });
    const res = await post(newBooking({ checkIn: "2026-07-08", checkOut: "2026-07-10" }));
    expect(res.status).toBe(201);
    expect(inserts(router)).toHaveLength(1);
  });

  it("AC-005 既有訂房已取消時不擋，回 201", async () => {
    const router = db({ existing: [existing({ status: "cancelled" })] });
    const res = await post(newBooking());
    expect(res.status).toBe(201);
    expect(inserts(router)).toHaveLength(1);
  });

  it("AC-005 完全包含既有訂房也回 409", async () => {
    db({ existing: [existing()] });
    const res = await post(newBooking({ checkIn: "2026-07-01", checkOut: "2026-07-31" }));
    expect(res.status).toBe(409);
  });

  it("AC-005 多筆重疊時全部列在 conflicts", async () => {
    db({
      existing: [
        existing({ id: "b1" }),
        existing({ id: "b2", checkIn: new Date("2026-07-12T00:00:00Z"), checkOut: new Date("2026-07-14T00:00:00Z") }),
      ],
    });
    const res = await post(newBooking({ checkIn: "2026-07-11", checkOut: "2026-07-13" }));
    expect(res.status).toBe(409);
    expect((await res.json()).conflicts.map((c: { id: string }) => c.id)).toEqual(["b1", "b2"]);
  });

  it("AC-005 重疊查詢限定同一使用者、同一物業、未取消", async () => {
    const router = db();
    await post(newBooking());
    const q = router.find(/FROM "Booking"[\s\S]*status <> 'cancelled'/)[0];
    expect(q.sql).toMatch(/"userId" = \$1/);
    expect(q.sql).toMatch(/"propertyId" = \$2/);
    expect(q.params).toEqual([
      TEST_USER.id,
      "p1",
      "2026-07-13T00:00:00.000Z",
      "2026-07-11T00:00:00.000Z",
    ]);
  });

  it("AC-005 建立的訂房本身是 cancelled 時不做重疊檢查", async () => {
    const router = db({ existing: [existing()] });
    const res = await post(newBooking({ status: "cancelled" }));
    expect(res.status).toBe(201);
    expect(router.find(/status <> 'cancelled'/)).toHaveLength(0);
  });

  it("AC-005 沒有既有訂房時建立成功，寫入的日期為 UTC ISO 字串", async () => {
    const router = db();
    const res = await post(newBooking());
    expect(res.status).toBe(201);
    const insert = inserts(router)[0];
    expect(insert.params.slice(1)).toEqual([
      "測試旅客B",
      "p1",
      TEST_USER.id,
      "2026-07-11T00:00:00.000Z",
      "2026-07-13T00:00:00.000Z",
      "manual",
      6000,
      "confirmed",
    ]);
  });
});

describe("AC-005 POST /api/bookings：日期規則", () => {
  it("AC-005 退房日等於入住日回 400", async () => {
    const router = db();
    const res = await post(newBooking({ checkIn: "2026-07-11", checkOut: "2026-07-11" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("退房日期需晚於入住日期");
    expect(inserts(router)).toHaveLength(0);
  });

  it("AC-005 退房日早於入住日回 400", async () => {
    const router = db();
    const res = await post(newBooking({ checkIn: "2026-07-13", checkOut: "2026-07-11" }));
    expect(res.status).toBe(400);
    expect(inserts(router)).toHaveLength(0);
  });

  it("AC-005 日期格式錯誤回 400", async () => {
    db();
    const res = await post(newBooking({ checkIn: "not-a-date" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("入住日期格式錯誤");
  });

  it("AC-005 不帶時區的時間回 400（避免依伺服器時區解讀）", async () => {
    const router = db();
    const res = await post(newBooking({ checkIn: "2026-07-11T15:00", checkOut: "2026-07-13T11:00" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("入住日期格式錯誤");
    expect(router.calls).toHaveLength(0);
  });

  it("AC-005 帶時區的 ISO 時間可以接受", async () => {
    db();
    const res = await post(newBooking({ checkIn: "2026-07-11T07:00:00Z", checkOut: "2026-07-13T03:00:00+08:00" }));
    expect(res.status).toBe(201);
  });

  it("AC-005 日期規則在查資料庫之前就擋下", async () => {
    const router = db();
    await post(newBooking({ checkIn: "2026-07-13", checkOut: "2026-07-11" }));
    expect(router.calls).toHaveLength(0);
  });
});

describe("AC-005 POST /api/bookings：其他驗證", () => {
  it("AC-005 金額不可為負數（400），但可以為 0（201）", async () => {
    db();
    expect((await post(newBooking({ totalPrice: -1 }))).status).toBe(400);
    expect((await post(newBooking({ totalPrice: 0 }))).status).toBe(201);
  });

  it("AC-005 不是自己的物業回 404，且不寫入", async () => {
    const router = db({ ownsProperty: false });
    const res = await post(newBooking());
    expect(res.status).toBe(404);
    expect(inserts(router)).toHaveLength(0);
    expect(router.find(/FROM "Property"/)[0].params).toEqual(["p1", TEST_USER.id]);
  });

  it("AC-005 未登入回 401", async () => {
    mockSession(auth, null);
    const router = db();
    expect((await post(newBooking())).status).toBe(401);
    expect(router.calls).toHaveLength(0);
  });

  it("AC-005 JSON 格式錯誤回 400", async () => {
    db();
    const res = await POST(
      new Request(URL_, { method: "POST", body: "{oops", headers: { "content-type": "application/json" } }),
    );
    expect(res.status).toBe(400);
  });

  it("AC-005 缺少必填欄位回 400", async () => {
    db();
    expect((await post({ propertyId: "p1" })).status).toBe(400);
  });
});

describe("AC-005 GET /api/bookings", () => {
  it("AC-005 只回傳自己的訂房（以 userId 限定）", async () => {
    const router = db({ existing: [existing()] });
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(200);
    expect(router.calls[0].sql).toMatch(/"userId" = \$1/);
    expect(router.calls[0].params).toEqual([TEST_USER.id]);
  });

  it("AC-005 未登入回 401", async () => {
    mockSession(auth, null);
    db();
    expect((await GET(new Request(URL_))).status).toBe(401);
  });
});
