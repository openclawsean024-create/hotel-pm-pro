// AC-006 (a)(b) Stripe webhook 測試
// 簽章用 Stripe SDK 的 stripe.webhooks.generateTestHeaderString 產生（Stripe 官方的測試事件簽章方式）；
// 資料庫以記憶體內的假資料層取代，不連任何真實服務。所有金鑰都是明顯的假字串。
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn(), withTransaction: vi.fn() }));
// 向 Stripe 取得訂閱最新狀態的呼叫以假資料取代（不連 Stripe）。
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  fetchSubscription: vi.fn(),
}));

import * as pg from "@/lib/pg-client";
import { fetchSubscription } from "@/lib/stripe";
import { installTransactionPassthrough } from "@/test-utils/mock-db";
import { POST } from "./route";

const WEBHOOK_SECRET = "whsec_dummy_placeholder";
const stripe = new Stripe("sk_test_dummy_placeholder");
const URL_ = "http://localhost/api/stripe/webhook";

// ---------- 記憶體內的假資料庫（只模擬 webhook 會用到的 SQL） ----------
interface SubRow {
  userId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  periodEnd: number | null;
}
interface UserRow {
  id: string;
  tier: string;
  stripeCustomerId: string | null;
}

let users: Map<string, UserRow>;
let subs: Map<string, SubRow>; // key = userId
let events: Set<string>;
let writes: string[];
let failNextWrite: string | null;
/** Stripe 端訂閱的實際狀態（fetchSubscription 回傳這份）。 */
let remote: { status: string; plan: string; cancelAtPeriodEnd: boolean };
let transactions: number;

function installFakeDb() {
  users = new Map([["user-test-1", { id: "user-test-1", tier: "free", stripeCustomerId: null }]]);
  subs = new Map();
  events = new Set();
  writes = [];
  failNextWrite = null;
  remote = { status: "active", plan: "pro", cancelAtPeriodEnd: false };
  transactions = 0;

  const run = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    const s = sql.replace(/\s+/g, " ").trim();
    const isWrite = /^(INSERT|UPDATE|DELETE)/.test(s);
    if (isWrite && !/"StripeEvent"/.test(s)) {
      if (failNextWrite && s.includes(failNextWrite)) {
        failNextWrite = null;
        throw new Error("simulated database failure");
      }
      writes.push(s);
    }

    if (s.startsWith('INSERT INTO "StripeEvent"')) {
      const id = params[0] as string;
      if (events.has(id)) return [];
      events.add(id);
      return [{ id }];
    }
    if (s.startsWith('DELETE FROM "StripeEvent"')) {
      events.delete(params[0] as string);
      return [];
    }
    if (s.startsWith('SELECT id FROM "User"')) {
      const u = users.get(params[0] as string);
      return u ? [{ id: u.id }] : [];
    }
    if (s.startsWith('INSERT INTO "Subscription"')) {
      expect(s).toMatch(/ON CONFLICT \("userId"\) DO UPDATE/);
      const [, userId, stripeSubscriptionId, stripePriceId, plan, status, cancelAtPeriodEnd, periodEnd] = params as [
        string, string, string, string, string, string, boolean, number | null,
      ];
      const prev = subs.get(userId);
      subs.set(userId, {
        userId,
        stripeSubscriptionId,
        stripePriceId,
        plan,
        status,
        cancelAtPeriodEnd,
        periodEnd: periodEnd ?? prev?.periodEnd ?? null,
      });
      return [];
    }
    if (s.startsWith('UPDATE "User" SET tier = $1, "stripeCustomerId"')) {
      const [tier, userId, customerId] = params as string[];
      const u = users.get(userId);
      if (u) {
        u.tier = tier;
        u.stripeCustomerId = u.stripeCustomerId ?? customerId;
      }
      return [];
    }
    if (s.startsWith('UPDATE "Subscription" SET status = $1')) {
      const [status, cancelAtPeriodEnd, periodEnd, priceId, plan, subId] = params as [
        string,
        boolean,
        number | null,
        string | null,
        string | null,
        string,
      ];
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === subId) {
          row.status = status;
          row.cancelAtPeriodEnd = cancelAtPeriodEnd;
          row.periodEnd = periodEnd ?? row.periodEnd;
          row.stripePriceId = priceId ?? row.stripePriceId;
          row.plan = plan ?? row.plan;
        }
      }
      return [];
    }
    if (s.startsWith('UPDATE "User" SET tier = $1, "updatedAt"')) {
      const [tier, subId] = params as string[];
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === subId) users.get(row.userId)!.tier = tier;
      }
      return [];
    }
    if (s.startsWith(`UPDATE "User" SET tier = 'free'`)) {
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === params[0]) users.get(row.userId)!.tier = "free";
      }
      return [];
    }
    if (s.startsWith(`UPDATE "Subscription" SET status = 'canceled'`)) {
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === params[0]) {
          row.status = "canceled";
          row.plan = "free";
          row.cancelAtPeriodEnd = false;
        }
      }
      return [];
    }
    if (s.startsWith(`UPDATE "Subscription" SET status = 'active'`)) {
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === params[0] && ["past_due", "incomplete"].includes(row.status)) {
          row.status = "active";
        }
      }
      return [];
    }
    if (s.startsWith(`UPDATE "Subscription" SET status = 'past_due'`)) {
      for (const row of subs.values()) {
        if (row.stripeSubscriptionId === params[0] && ["active", "trialing"].includes(row.status)) {
          row.status = "past_due";
        }
      }
      return [];
    }
    throw new Error(`假資料庫不認得這個 SQL：${s}`);
  };

  (pg.pgQuery as Mock).mockImplementation(run);
  (pg.pgQueryOne as Mock).mockImplementation(async (sql: string, params?: unknown[]) => (await run(sql, params))[0] ?? null);

  // 交易：開始時記下快照，失敗時還原（模擬 Postgres ROLLBACK）。
  let snapshot: { users: Map<string, UserRow>; subs: Map<string, SubRow>; events: Set<string>; writes: string[] } | null = null;
  const clone = <T,>(m: Map<string, T>) => new Map([...m].map(([k, v]) => [k, { ...v }]));
  installTransactionPassthrough(
    pg,
    () => {
      users = snapshot!.users;
      subs = snapshot!.subs;
      events = snapshot!.events;
      writes.splice(0, writes.length, ...snapshot!.writes);
    },
    () => {
      transactions += 1;
      snapshot = { users: clone(users), subs: clone(subs), events: new Set(events), writes: [...writes] };
    },
  );

  (fetchSubscription as Mock).mockImplementation(async (_stripe: unknown, id: string) => ({
    id,
    object: "subscription",
    status: remote.status,
    cancel_at_period_end: remote.cancelAtPeriodEnd,
    items: { data: [{ current_period_end: 1797480000, price: { id: `price_dummy_${remote.plan}` } }] },
  }));
}

// ---------- 測試事件 ----------
let seq = 0;
function makeEvent(type: string, object: Record<string, unknown>, over: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `evt_test_${String(seq).padStart(4, "0")}`,
    object: "event",
    api_version: "2026-07-29.dahlia",
    created: 1794888000,
    livemode: false,
    type,
    data: { object },
    ...over,
  };
}

function signedRequest(event: unknown, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request(URL_, { method: "POST", body: payload, headers: { "stripe-signature": header } });
}

/** 結帳完成事件。Stripe 端的訂閱預設與結帳要求的方案一致（測試可再改 remote 模擬不一致）。 */
const checkoutCompleted = (over: Record<string, unknown> = {}) => {
  const plan = (over.metadata as { plan?: string } | undefined)?.plan;
  if (plan === "pro" || plan === "business") remote.plan = plan;
  return checkoutEvent(over);
};
const checkoutEvent = (over: Record<string, unknown> = {}) =>
  makeEvent("checkout.session.completed", {
    id: "cs_test_fake_0001",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    customer: "cus_test_fake_0001",
    subscription: "sub_test_fake_0001",
    metadata: { userId: "user-test-1", plan: "pro" },
    ...over,
  });

const subscriptionEvent = (type: string, over: Record<string, unknown> = {}) =>
  makeEvent(type, {
    id: "sub_test_fake_0001",
    object: "subscription",
    customer: "cus_test_fake_0001",
    status: "active",
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1797480000, price: { id: "price_dummy_pro" } }] },
    ...over,
  });

const send = (event: unknown) => POST(signedRequest(event));

/** 先完成一次 Pro 結帳，回到「已訂閱 Pro」的狀態。 */
async function subscribePro() {
  const res = await send(checkoutCompleted());
  expect(res.status).toBe(200);
  writes.length = 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  installFakeDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AC-006 (a) 簽章驗證", () => {
  it("AC-006 沒有 stripe-signature 標頭回 400", async () => {
    const res = await POST(new Request(URL_, { method: "POST", body: JSON.stringify(checkoutCompleted()) }));
    expect(res.status).toBe(400);
    expect(pg.pgQuery).not.toHaveBeenCalled();
    expect(pg.pgQueryOne).not.toHaveBeenCalled();
  });

  it("AC-006 簽章錯誤（用別的 secret 簽）回 400，且不碰資料庫", async () => {
    const res = await POST(signedRequest(checkoutCompleted(), "whsec_wrong_placeholder"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid signature");
    expect(pg.pgQuery).not.toHaveBeenCalled();
    expect(pg.pgQueryOne).not.toHaveBeenCalled();
    expect(subs.size).toBe(0);
  });

  it("AC-006 payload 被竄改（簽章對不上）回 400", async () => {
    const event = checkoutCompleted();
    const header = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(event),
      secret: WEBHOOK_SECRET,
    });
    const tampered = JSON.stringify({
      ...event,
      data: { object: { ...event.data.object, metadata: { userId: "user-test-1", plan: "business" } } },
    });
    const res = await POST(new Request(URL_, { method: "POST", body: tampered, headers: { "stripe-signature": header } }));
    expect(res.status).toBe(400);
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 過期的簽章（超過容許時間）回 400", async () => {
    const event = checkoutCompleted();
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    const res = await POST(new Request(URL_, { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(res.status).toBe(400);
  });
});

describe("AC-006 (a) checkout.session.completed 建立或更新 Subscription", () => {
  it("AC-006 新使用者沒有 Subscription 列時會建立，並更新 User.tier（修正只 UPDATE 的缺陷）", async () => {
    expect(subs.has("user-test-1")).toBe(false);
    const res = await send(checkoutCompleted());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: true });
    expect(subs.get("user-test-1")).toMatchObject({
      userId: "user-test-1",
      stripeSubscriptionId: "sub_test_fake_0001",
      stripePriceId: "price_dummy_pro",
      plan: "pro",
      status: "active",
      cancelAtPeriodEnd: false,
    });
    expect(users.get("user-test-1")).toMatchObject({ tier: "pro", stripeCustomerId: "cus_test_fake_0001" });
  });

  it("AC-006 已有 Subscription 列（例如 seed 的 free）時更新為新方案", async () => {
    subs.set("user-test-1", {
      userId: "user-test-1",
      stripeSubscriptionId: null,
      stripePriceId: null,
      plan: "free",
      status: "active",
      cancelAtPeriodEnd: false,
      periodEnd: null,
    });
    const res = await send(checkoutCompleted({ metadata: { userId: "user-test-1", plan: "business" } }));
    expect(res.status).toBe(200);
    expect(subs.size).toBe(1);
    expect(subs.get("user-test-1")).toMatchObject({
      plan: "business",
      stripePriceId: "price_dummy_business",
      stripeSubscriptionId: "sub_test_fake_0001",
    });
    expect(users.get("user-test-1")!.tier).toBe("business");
  });

  it("AC-006 已有 stripeCustomerId 時不覆蓋", async () => {
    users.get("user-test-1")!.stripeCustomerId = "cus_test_fake_existing";
    await send(checkoutCompleted());
    expect(users.get("user-test-1")!.stripeCustomerId).toBe("cus_test_fake_existing");
  });

  it("AC-006 沒有 metadata 的結帳事件（例如 stripe trigger 的範例事件）回 200 但不寫入", async () => {
    const res = await send(checkoutCompleted({ mode: "payment", metadata: {} }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: false });
    expect(writes).toEqual([]);
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 metadata 的方案不是 pro／business 時不寫入", async () => {
    const res = await send(checkoutCompleted({ metadata: { userId: "user-test-1", plan: "enterprise" } }));
    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
  });

  it("AC-006 尚未付款（payment_status = unpaid）不升級", async () => {
    await send(checkoutCompleted({ payment_status: "unpaid" }));
    expect(writes).toEqual([]);
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 找不到使用者時不建立 Subscription", async () => {
    const res = await send(checkoutCompleted({ metadata: { userId: "user-missing", plan: "pro" } }));
    expect(res.status).toBe(200);
    expect(subs.size).toBe(0);
    expect(writes).toEqual([]);
  });
});

describe("AC-006 (a) customer.subscription.updated 同步方案", () => {
  it("AC-006 Pro 升級 Business：依 price id 同步 Subscription.plan 與 User.tier", async () => {
    await subscribePro();
    const res = await send(
      subscriptionEvent("customer.subscription.updated", {
        items: { data: [{ current_period_end: 1797480000, price: { id: "price_dummy_business" } }] },
      }),
    );
    expect(res.status).toBe(200);
    expect(subs.get("user-test-1")).toMatchObject({
      plan: "business",
      stripePriceId: "price_dummy_business",
      status: "active",
      periodEnd: 1797480000,
    });
    expect(users.get("user-test-1")!.tier).toBe("business");
  });

  it("AC-006 Business 降級 Pro", async () => {
    await send(checkoutCompleted({ metadata: { userId: "user-test-1", plan: "business" } }));
    await send(subscriptionEvent("customer.subscription.updated"));
    expect(subs.get("user-test-1")!.plan).toBe("pro");
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 設定期末取消：記錄 cancelAtPeriodEnd，方案在到期前不變", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.updated", { cancel_at_period_end: true }));
    expect(subs.get("user-test-1")).toMatchObject({ cancelAtPeriodEnd: true, plan: "pro", status: "active" });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 扣款失敗進入 past_due：記錄狀態，方案暫時保留", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.updated", { status: "past_due" }));
    expect(subs.get("user-test-1")).toMatchObject({ status: "past_due", plan: "pro" });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 狀態變成 unpaid 或 canceled 時降回 free", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.updated", { status: "unpaid" }));
    expect(subs.get("user-test-1")).toMatchObject({ status: "unpaid", plan: "free" });
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 不是我們設定的 price id 時維持原方案", async () => {
    await subscribePro();
    await send(
      subscriptionEvent("customer.subscription.updated", {
        items: { data: [{ current_period_end: 1797480000, price: { id: "price_unknown_fake" } }] },
      }),
    );
    expect(subs.get("user-test-1")!.plan).toBe("pro");
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 舊訂閱（不是使用者目前的訂閱）的事件不會改到方案", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.updated", { id: "sub_test_fake_old", status: "canceled" }));
    expect(subs.get("user-test-1")).toMatchObject({ plan: "pro", status: "active" });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });
});

describe("AC-006 (a) customer.subscription.deleted 降回 free", () => {
  it("AC-006 取消訂閱後 Subscription 與 User 都回到 free", async () => {
    await subscribePro();
    const res = await send(subscriptionEvent("customer.subscription.deleted", { status: "canceled" }));
    expect(res.status).toBe(200);
    expect(subs.get("user-test-1")).toMatchObject({ plan: "free", status: "canceled", cancelAtPeriodEnd: false });
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 舊訂閱被刪除不影響目前的訂閱", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.deleted", { id: "sub_test_fake_old", status: "canceled" }));
    expect(users.get("user-test-1")!.tier).toBe("pro");
    expect(subs.get("user-test-1")!.plan).toBe("pro");
  });
});

describe("AC-006 (a) 冪等：同一事件重送不重複處理", () => {
  it("AC-006 同一個 checkout.session.completed 重送：第二次回 duplicate，不再寫入", async () => {
    const event = checkoutCompleted();
    const first = await send(event);
    expect(first.status).toBe(200);
    const writesAfterFirst = [...writes];
    expect(writesAfterFirst.length).toBe(2); // Subscription upsert + User update
    const stateAfterFirst = JSON.stringify([[...subs], [...users]]);

    const second = await send(event);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    expect(writes).toEqual(writesAfterFirst);
    expect(JSON.stringify([[...subs], [...users]])).toBe(stateAfterFirst);
  });

  it("AC-006 重送舊的「取消訂閱」事件不會把重新訂閱的使用者再降級一次", async () => {
    await subscribePro();
    const deleted = subscriptionEvent("customer.subscription.deleted", { status: "canceled" });
    await send(deleted);
    expect(users.get("user-test-1")!.tier).toBe("free");

    // 使用者重新訂閱 Business（新的事件、同一個 subscription id 以凸顯冪等的效果）
    await send(checkoutCompleted({ metadata: { userId: "user-test-1", plan: "business" } }));
    expect(users.get("user-test-1")!.tier).toBe("business");

    const replay = await send(deleted);
    expect(await replay.json()).toEqual({ received: true, duplicate: true });
    expect(users.get("user-test-1")!.tier).toBe("business");
    expect(subs.get("user-test-1")!.plan).toBe("business");
  });

  it("AC-006 冪等以 event.id 判斷，並用 ON CONFLICT DO NOTHING 佔位", async () => {
    const event = checkoutCompleted();
    await send(event);
    const claim = (pg.pgQueryOne as Mock).mock.calls.find(([sql]) => /INSERT INTO "StripeEvent"/.test(sql));
    expect(claim![0]).toMatch(/ON CONFLICT \(id\) DO NOTHING\s+RETURNING id/);
    expect(claim![1]).toEqual([event.id, "checkout.session.completed"]);
    expect(events.has(event.id)).toBe(true);
  });

  it("AC-006 不同 event id 的相同內容仍會處理（冪等不是靠內容比對）", async () => {
    await send(checkoutCompleted());
    const before = writes.length;
    await send(checkoutCompleted());
    expect(writes.length).toBe(before + 2);
    expect(subs.size).toBe(1);
  });

  it("AC-006 佔位與處理在同一個交易：處理到一半失敗，佔位與已寫入的資料一起回滾", async () => {
    const event = checkoutCompleted();
    failNextWrite = 'UPDATE "User" SET tier = $1, "stripeCustomerId"'; // Subscription 已寫入後才失敗
    const first = await send(event);
    expect(first.status).toBe(500);
    expect(transactions).toBe(1);
    expect(events.has(event.id)).toBe(false);
    expect(subs.has("user-test-1")).toBe(false);
    expect(users.get("user-test-1")!.tier).toBe("free");
    // 不再依賴「失敗後另外 DELETE 佔位」（程序中途被終止時那段程式根本不會執行）
    const deletes = (pg.pgQuery as Mock).mock.calls.filter(([sql]) => /DELETE FROM "StripeEvent"/.test(sql));
    expect(deletes).toHaveLength(0);

    const retry = await send(event);
    expect(await retry.json()).toEqual({ received: true, handled: true });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 處理失敗回 500 並釋放佔位，Stripe 重送時可以重新處理", async () => {
    const event = checkoutCompleted();
    failNextWrite = 'INSERT INTO "Subscription"';
    const first = await send(event);
    expect(first.status).toBe(500);
    expect(events.has(event.id)).toBe(false);
    expect(users.get("user-test-1")!.tier).toBe("free");

    const retry = await send(event);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ received: true, handled: true });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 未處理的事件類型也回 200 並記錄，重送不重複", async () => {
    const event = makeEvent("customer.created", { id: "cus_test_fake_0001", object: "customer" });
    const first = await send(event);
    expect(await first.json()).toEqual({ received: true, handled: false });
    const second = await send(event);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    expect(writes).toEqual([]);
  });
});

describe("AC-006 (a) 事件順序顛倒與方案來源", () => {
  it("AC-006 結帳完成晚於取消送達：以 Stripe 上訂閱的實際狀態為準，不給付費方案", async () => {
    remote.status = "canceled";
    const res = await send(checkoutCompleted());
    expect(await res.json()).toEqual({ received: true, handled: true });
    expect(subs.get("user-test-1")).toMatchObject({ status: "canceled", plan: "free", stripeSubscriptionId: "sub_test_fake_0001" });
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 訂閱仍在 past_due（寬限期）時照實記錄狀態並保留方案", async () => {
    remote.status = "past_due";
    await send(checkoutCompleted());
    expect(subs.get("user-test-1")).toMatchObject({ status: "past_due", plan: "pro" });
    expect(users.get("user-test-1")!.tier).toBe("pro");
  });

  it("AC-006 方案取自訂閱的 price：metadata 寫 business 但實際買的是 pro，不升級", async () => {
    remote.plan = "pro";
    const res = await send(checkoutEvent({ metadata: { userId: "user-test-1", plan: "business" } }));
    expect(await res.json()).toEqual({ received: true, handled: false });
    expect(writes).toEqual([]);
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 訂閱的 price 不是本站方案時不寫入", async () => {
    remote.plan = "unknown";
    const res = await send(checkoutEvent());
    expect(await res.json()).toEqual({ received: true, handled: false });
    expect(writes).toEqual([]);
  });

  it("AC-006 向 Stripe 取得的是結帳事件所指的訂閱", async () => {
    await send(checkoutCompleted());
    expect(fetchSubscription).toHaveBeenCalledTimes(1);
    expect((fetchSubscription as Mock).mock.calls[0][1]).toBe("sub_test_fake_0001");
  });
});

describe("AC-006 (a) invoice 事件同步訂閱狀態", () => {
  const invoice = (type: string) =>
    makeEvent(type, {
      id: "in_test_fake_0001",
      object: "invoice",
      parent: { subscription_details: { subscription: "sub_test_fake_0001" } },
    });

  it("AC-006 invoice.payment_failed 把 active 的訂閱標為 past_due（方案暫不變）", async () => {
    await subscribePro();
    await send(invoice("invoice.payment_failed"));
    expect(subs.get("user-test-1")).toMatchObject({ status: "past_due", plan: "pro" });
  });

  it("AC-006 invoice.paid 把 past_due 的訂閱恢復為 active", async () => {
    await subscribePro();
    await send(invoice("invoice.payment_failed"));
    await send(invoice("invoice.paid"));
    expect(subs.get("user-test-1")!.status).toBe("active");
  });

  it("AC-006 invoice.paid 不會讓已取消的訂閱復活", async () => {
    await subscribePro();
    await send(subscriptionEvent("customer.subscription.deleted", { status: "canceled" }));
    await send(invoice("invoice.paid"));
    expect(subs.get("user-test-1")).toMatchObject({ status: "canceled", plan: "free" });
  });

  it("AC-006 沒有對應訂閱的發票不寫入", async () => {
    await send(makeEvent("invoice.paid", { id: "in_test_fake_0002", object: "invoice" }));
    expect(writes).toEqual([]);
  });
});

describe("AC-006 (b) 非 production 環境拒絕 sk_live_ 金鑰與正式模式事件", () => {
  // 不把完整的 live 金鑰樣式寫成字面值，避免被金鑰掃描誤判；值本身是假的。
  const FAKE_LIVE_KEY = ["sk", "live", "dummyplaceholder"].join("_");

  it("AC-006 STRIPE_SECRET_KEY 是 sk_live_ 開頭時 webhook 回 503，不驗簽、不碰資料庫", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_LIVE_KEY);
    const res = await send(checkoutCompleted());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/非 production 環境不得使用 Stripe 正式金鑰/);
    expect(pg.pgQuery).not.toHaveBeenCalled();
    expect(pg.pgQueryOne).not.toHaveBeenCalled();
    expect(users.get("user-test-1")!.tier).toBe("free");
  });

  it("AC-006 錯誤訊息不含金鑰內容", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_LIVE_KEY);
    const res = await send(checkoutCompleted());
    expect(JSON.stringify(await res.json())).not.toContain("dummyplaceholder");
  });

  it("AC-006 沒有設定 STRIPE_SECRET_KEY 或 STRIPE_WEBHOOK_SECRET 時回 503", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await send(checkoutCompleted())).status).toBe(503);
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await send(checkoutCompleted())).status).toBe(503);
    expect(pg.pgQueryOne).not.toHaveBeenCalled();
  });

  it("AC-006 livemode = true 的事件在非 production 環境回 400，不處理", async () => {
    const res = await send(checkoutCompleted({}));
    expect(res.status).toBe(200);
    installFakeDb();
    const live = { ...checkoutCompleted(), livemode: true };
    const rejected = await send(live);
    expect(rejected.status).toBe(400);
    expect(writes).toEqual([]);
    expect(events.size).toBe(0);
  });
});
