// AC-007 ICS 匯入 API 測試：轉成訂房、UID 去重、重疊回報、SSRF 防護、逾時與大小上限。
// fetch 與 DNS 都以 mock 取代；ICS 內容來自 tests/fixtures/ 下自行編寫的假檔案。
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { installTransactionPassthrough, jsonRequest, mockSession, TEST_USER } from "@/test-utils/mock-db";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn(), withTransaction: vi.fn() }));

import { lookup } from "node:dns/promises";
import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import { icsBookingId } from "@/lib/ics-booking";
import { POST } from "./route";

const URL_ = "http://localhost/api/ics/import";
const ICS_URL = "https://calendar.example.test/fake-airbnb.ics";
const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, "../../../../../tests/fixtures", name), "utf8");

const fetchMock = vi.fn();

// ---------- 記憶體內的假資料庫 ----------
interface BookingRow {
  id: string;
  guestName: string;
  propertyId: string;
  userId: string;
  checkIn: string;
  checkOut: string;
  channel: string;
  totalPrice: number;
  status: string;
}
let properties: Array<{ id: string; userId: string }>;
let bookings: BookingRow[];
let icsEvents: Map<string, { propertyId: string; uid: string; source: string }>;
let sqlLog: Array<{ sql: string; params: unknown[] }>;

function installFakeDb() {
  properties = [{ id: "p1", userId: TEST_USER.id }];
  bookings = [];
  icsEvents = new Map();
  sqlLog = [];
  const run = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    const s = sql.replace(/\s+/g, " ").trim();
    sqlLog.push({ sql: s, params });
    if (s.startsWith("SELECT pg_advisory_xact_lock")) return [{}];
    if (s.startsWith('SELECT id FROM "Property"')) {
      return properties.filter((p) => p.id === params[0] && p.userId === params[1]).map((p) => ({ id: p.id }));
    }
    if (s.startsWith('SELECT id, "checkIn", "checkOut", status FROM "Booking"')) {
      expect(s).toMatch(/"userId" = \$1 AND "propertyId" = \$2 AND status <> 'cancelled'/);
      return bookings
        .filter((b) => b.userId === params[0] && b.propertyId === params[1] && b.status !== "cancelled")
        .map(({ id, checkIn, checkOut, status }) => ({ id, checkIn: new Date(checkIn), checkOut: new Date(checkOut), status }));
    }
    if (s.startsWith('SELECT id FROM "Booking" WHERE "userId" = $1 AND id = ANY')) {
      const ids = params[1] as string[];
      return bookings.filter((b) => b.userId === params[0] && ids.includes(b.id)).map((b) => ({ id: b.id }));
    }
    if (s.startsWith('INSERT INTO "IcsEvent"')) {
      expect(s).toMatch(/ON CONFLICT \("userId", uid\) DO NOTHING RETURNING id/);
      const [id, userId, propertyId, uid, , , , source] = params as string[];
      const key = `${userId}\n${uid}`;
      if (icsEvents.has(key)) return [];
      icsEvents.set(key, { propertyId, uid, source });
      return [{ id }];
    }
    if (s.startsWith('INSERT INTO "Booking"')) {
      expect(s).toMatch(/ON CONFLICT \(id\) DO NOTHING RETURNING id/);
      const [id, guestName, propertyId, userId, checkIn, checkOut, channel] = params as string[];
      if (bookings.some((b) => b.id === id)) return [];
      bookings.push({ id, guestName, propertyId, userId, checkIn, checkOut, channel, totalPrice: 0, status: "confirmed" });
      return [{ id }];
    }
    throw new Error(`假資料庫不認得這個 SQL：${s}`);
  };
  (pg.pgQuery as Mock).mockImplementation(run);
  (pg.pgQueryOne as Mock).mockImplementation(async (sql: string, params?: unknown[]) => (await run(sql, params))[0] ?? null);
  installTransactionPassthrough(pg);
}

const icsResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/calendar; charset=utf-8" } });

const post = (body: unknown) => POST(jsonRequest(URL_, "POST", body));
const importFixture = async (name: string, source = "airbnb", url = ICS_URL) => {
  fetchMock.mockResolvedValueOnce(icsResponse(fixture(name)));
  const res = await post({ propertyId: "p1", icsUrl: url, source });
  return { res, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  (lookup as unknown as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mockSession(auth, TEST_USER);
  installFakeDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AC-007 ICS 匯入與手動訂房共用物業鎖", () => {
  it("AC-007 先取得物業的鎖，再讀取既有訂房與寫入（同一個交易）", async () => {
    const { res } = await importFixture("airbnb-fake.ics");
    expect(res.status).toBe(200);
    expect(pg.withTransaction).toHaveBeenCalledTimes(1);
    const lock = sqlLog.findIndex((q) => q.sql.startsWith("SELECT pg_advisory_xact_lock"));
    const read = sqlLog.findIndex((q) => q.sql.startsWith('SELECT id, "checkIn", "checkOut", status FROM "Booking"'));
    const write = sqlLog.findIndex((q) => q.sql.startsWith('INSERT INTO "Booking"'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(read);
    expect(read).toBeLessThan(write);
    expect(sqlLog[lock].params).toEqual(["p1"]);
  });
});

describe("AC-007 ICS 匯入轉成訂房", () => {
  it("AC-007 假 Airbnb fixture：3 筆事件都寫入 IcsEvent 並建立 3 筆訂房", async () => {
    const { res, body } = await importFixture("airbnb-fake.ics");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ imported: 3, skipped: 0, bookingsCreated: 3, bookingsExisting: 0, overlapped: 0 });
    expect(body.events.map((e: { booking: string }) => e.booking)).toEqual(["created", "created", "created"]);
    expect(bookings).toHaveLength(3);
    expect(bookings[0]).toMatchObject({
      id: icsBookingId(TEST_USER.id, "fake-airbnb-0001@fixture.hotel-pm.test"),
      guestName: "Reserved",
      propertyId: "p1",
      userId: TEST_USER.id,
      checkIn: "2027-01-02T00:00:00.000Z",
      checkOut: "2027-01-05T00:00:00.000Z",
      channel: "airbnb",
      totalPrice: 0,
      status: "confirmed",
    });
  });

  it("AC-007 訂房的 channel 等於匯入來源（booking）", async () => {
    const { body } = await importFixture("booking-fake.ics", "booking");
    expect(body).toMatchObject({ imported: 2, bookingsCreated: 2 });
    expect(bookings.map((b) => b.channel)).toEqual(["booking", "booking"]);
    expect(bookings.map((b) => b.guestName)).toEqual(["CLOSED - Not available", "CLOSED - Not available"]);
  });

  it("AC-007 重複匯入同一個檔案：以 UID 去重，不會產生第二筆訂房", async () => {
    await importFixture("airbnb-fake.ics");
    const { res, body } = await importFixture("airbnb-fake.ics");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ imported: 0, skipped: 3, bookingsCreated: 0, bookingsExisting: 3, overlapped: 0 });
    expect(bookings).toHaveLength(3);
    expect(icsEvents.size).toBe(3);
  });

  it("AC-007 Booking.id 由 (userId, UID) 決定：同 UID 同使用者固定、不同使用者不同", () => {
    const a = icsBookingId("user-a", "uid-1@fixture.hotel-pm.test");
    expect(a).toBe(icsBookingId("user-a", "uid-1@fixture.hotel-pm.test"));
    expect(a).not.toBe(icsBookingId("user-b", "uid-1@fixture.hotel-pm.test"));
    expect(a).not.toBe(icsBookingId("user-a", "uid-2@fixture.hotel-pm.test"));
    expect(a).toMatch(/^ics_[0-9a-f]{24}$/);
  });

  it("AC-007 與既有訂房重疊的事件不建立訂房，並回報數量與標記", async () => {
    bookings.push({
      id: "manual-1",
      guestName: "測試旅客A",
      propertyId: "p1",
      userId: TEST_USER.id,
      checkIn: "2027-01-03T00:00:00.000Z",
      checkOut: "2027-01-06T00:00:00.000Z",
      channel: "manual",
      totalPrice: 9000,
      status: "confirmed",
    });
    const { body } = await importFixture("airbnb-fake.ics");
    expect(body).toMatchObject({ imported: 3, bookingsCreated: 2, overlapped: 1 });
    expect(body.events[0]).toMatchObject({ uid: "fake-airbnb-0001@fixture.hotel-pm.test", booking: "overlapped" });
    expect(bookings).toHaveLength(3); // 既有 1 筆 + 新建 2 筆
    expect(bookings.some((b) => b.id === icsBookingId(TEST_USER.id, "fake-airbnb-0001@fixture.hotel-pm.test"))).toBe(false);
  });

  it("AC-007 與既有訂房相鄰（既有退房日 = 事件入住日）不算重疊", async () => {
    bookings.push({
      id: "manual-1",
      guestName: "測試旅客A",
      propertyId: "p1",
      userId: TEST_USER.id,
      checkIn: "2026-12-30T00:00:00.000Z",
      checkOut: "2027-01-02T00:00:00.000Z",
      channel: "manual",
      totalPrice: 9000,
      status: "confirmed",
    });
    const { body } = await importFixture("airbnb-fake.ics");
    expect(body).toMatchObject({ bookingsCreated: 3, overlapped: 0 });
  });

  it("AC-007 已取消的既有訂房不擋匯入", async () => {
    bookings.push({
      id: "manual-cancelled",
      guestName: "測試旅客A",
      propertyId: "p1",
      userId: TEST_USER.id,
      checkIn: "2027-01-03T00:00:00.000Z",
      checkOut: "2027-01-06T00:00:00.000Z",
      channel: "manual",
      totalPrice: 9000,
      status: "cancelled",
    });
    const { body } = await importFixture("airbnb-fake.ics");
    expect(body).toMatchObject({ bookingsCreated: 3, overlapped: 0 });
  });

  it("AC-007 同一批匯入裡互相重疊的事件：先到的建立，後到的標記重疊", async () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:fake-dup-a@fixture.hotel-pm.test",
      "DTSTART;VALUE=DATE:20270501",
      "DTEND;VALUE=DATE:20270505",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:fake-dup-b@fixture.hotel-pm.test",
      "DTSTART;VALUE=DATE:20270503",
      "DTEND;VALUE=DATE:20270507",
      "SUMMARY:Airbnb (Not available)",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    fetchMock.mockResolvedValueOnce(icsResponse(text));
    const body = await (await post({ propertyId: "p1", icsUrl: ICS_URL })).json();
    expect(body).toMatchObject({ imported: 2, bookingsCreated: 1, overlapped: 1 });
    expect(body.events.map((e: { booking: string }) => e.booking)).toEqual(["created", "overlapped"]);
  });

  it("AC-007 時區事件以 UTC 時間寫入訂房；缺 UID 的事件不會匯入", async () => {
    const { body } = await importFixture("edge-cases-fake.ics", "manual");
    expect(body).toMatchObject({ imported: 4, bookingsCreated: 4, overlapped: 0 });
    const taipei = bookings.find((b) => b.id === icsBookingId(TEST_USER.id, "fake-edge-tz-taipei@fixture.hotel-pm.test"))!;
    expect(taipei.checkIn).toBe("2027-03-01T07:00:00.000Z");
    expect(taipei.checkOut).toBe("2027-03-03T03:00:00.000Z");
    expect(bookings.some((b) => b.guestName === "沒有 UID 的事件")).toBe(false);
  });

  it("AC-007 沒有任何事件的 ICS 回 200 與全 0 的統計", async () => {
    fetchMock.mockResolvedValueOnce(icsResponse("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n"));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(await res.json()).toEqual({
      imported: 0,
      skipped: 0,
      bookingsCreated: 0,
      bookingsExisting: 0,
      overlapped: 0,
      events: [],
    });
  });

  it("AC-007 所有寫入都帶 userId 與使用者自己的 propertyId", async () => {
    await importFixture("airbnb-fake.ics");
    for (const { sql, params } of sqlLog.filter((c) => c.sql.startsWith("INSERT"))) {
      expect(params).toContain(TEST_USER.id);
      expect(params).toContain("p1");
      expect(sql).toMatch(/"userId"/);
    }
  });
});

describe("AC-007 SSRF 防護（API 層）", () => {
  it("AC-007 http://127.0.0.1 與 http://169.254.169.254 被拒（400），不發請求、不查資料庫", async () => {
    for (const icsUrl of ["http://127.0.0.1/cal.ics", "http://169.254.169.254/latest/meta-data/"]) {
      const res = await post({ propertyId: "p1", icsUrl });
      expect(res.status, icsUrl).toBe(400);
      expect((await res.json()).error).toMatch(/僅支援 https/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sqlLog).toHaveLength(0);
  });

  it("AC-007 https 的內部位址同樣被拒（400）", async () => {
    for (const icsUrl of [
      "https://127.0.0.1/cal.ics",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.8/cal.ics",
      "https://192.168.1.1/cal.ics",
      "https://[::1]/cal.ics",
      "https://localhost/cal.ics",
      "https://db.internal/cal.ics",
    ]) {
      const res = await post({ propertyId: "p1", icsUrl });
      expect(res.status, icsUrl).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 非 http(s) 協定被拒（400）", async () => {
    for (const icsUrl of ["file:///etc/passwd", "ftp://calendar.example.test/a.ics", "webcal://calendar.example.test/a.ics", "not a url"]) {
      expect((await post({ propertyId: "p1", icsUrl })).status, icsUrl).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 主機名稱解析到內部位址時被拒（400），不發請求", async () => {
    (lookup as unknown as Mock).mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    const res = await post({ propertyId: "p1", icsUrl: "https://rebind.example.test/cal.ics" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/內部或保留的 IP/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bookings).toHaveLength(0);
  });

  it("AC-007 來源轉址到內部位址時被拒（400）", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/cal.ics" } }));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("AC-007 逾時、大小上限與來源錯誤", () => {
  it("AC-007 fetch 逾時：來源 10 秒未回應時回 504，且請求已被中止", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const pending = post({ propertyId: "p1", icsUrl: ICS_URL });
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;
    expect(res.status).toBe(504);
    expect((await res.json()).error).toBe("ICS 來源超過 10 秒未回應");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(bookings).toHaveLength(0);
  });

  it("AC-007 超過 2 MB 的回應回 413，不解析、不寫入", async () => {
    fetchMock.mockResolvedValueOnce(icsResponse("A".repeat(2 * 1024 * 1024 + 1)));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(413);
    expect(icsEvents.size).toBe(0);
  });

  it("AC-007 Content-Length 宣告超過上限時直接回 413", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("x", { status: 200, headers: { "content-length": String(50 * 1024 * 1024) } }),
    );
    expect((await post({ propertyId: "p1", icsUrl: ICS_URL })).status).toBe(413);
  });

  it("AC-007 來源回 404／500 時回 502", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ICS 來源回應 404");
  });

  it("AC-007 網路錯誤回 502，錯誤訊息不含內部細節", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("connect ECONNREFUSED 10.0.0.1:443"));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.1");
  });

  it("AC-007 不支援的時區讓整份 ICS 回 400，不寫入任何資料", async () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:fake-bad-tz@fixture.hotel-pm.test",
      "DTSTART;TZID=Mars/Olympus_Mons:20270601T150000",
      "DTEND;TZID=Mars/Olympus_Mons:20270602T110000",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    fetchMock.mockResolvedValueOnce(icsResponse(text));
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/不支援的時區/);
    expect(icsEvents.size).toBe(0);
    expect(bookings).toHaveLength(0);
  });

  it("AC-007 空的回應內容回 400", async () => {
    fetchMock.mockResolvedValueOnce(icsResponse(""));
    expect((await post({ propertyId: "p1", icsUrl: ICS_URL })).status).toBe(400);
  });
});

describe("AC-007 存取控制與輸入驗證", () => {
  it("AC-007 未登入回 401", async () => {
    mockSession(auth, null);
    expect((await post({ propertyId: "p1", icsUrl: ICS_URL })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 不是自己的物業回 404，且不會去抓 ICS", async () => {
    properties = [{ id: "p1", userId: "user-other" }];
    const res = await post({ propertyId: "p1", icsUrl: ICS_URL });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-007 缺少欄位、來源不在允許清單、JSON 錯誤都回 400", async () => {
    expect((await post({ icsUrl: ICS_URL })).status).toBe(400);
    expect((await post({ propertyId: "p1" })).status).toBe(400);
    expect((await post({ propertyId: "p1", icsUrl: ICS_URL, source: "agoda" })).status).toBe(400);
    const bad = await POST(new Request(URL_, { method: "POST", body: "{", headers: { "content-type": "application/json" } }));
    expect(bad.status).toBe(400);
  });
});
