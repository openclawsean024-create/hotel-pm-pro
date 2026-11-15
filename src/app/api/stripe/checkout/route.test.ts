// AC-006 (b) Stripe checkout 測試：非 production 環境拒絕 sk_live_ 金鑰；其餘為測試模式的基本行為。
// Stripe SDK 以 vi.mock 取代，不會呼叫 Stripe。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installSqlRouter, jsonRequest, mockSession, TEST_USER } from "@/test-utils/mock-db";

const stripeMock = vi.hoisted(() => ({
  ctor: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    customers = { create: stripeMock.customersCreate };
    checkout = { sessions: { create: stripeMock.sessionsCreate } };
    constructor(key: string, opts: unknown) {
      stripeMock.ctor(key, opts);
    }
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/pg-client", () => ({ pgQuery: vi.fn(), pgQueryOne: vi.fn() }));

import { auth } from "@/lib/auth";
import * as pg from "@/lib/pg-client";
import { POST } from "./route";

const URL_ = "http://localhost/api/stripe/checkout";
const FAKE_LIVE_KEY = ["sk", "live", "dummyplaceholder"].join("_");
const FAKE_RESTRICTED_LIVE_KEY = ["rk", "live", "dummyplaceholder"].join("_");

function db(user: Record<string, unknown> | null = {
  id: TEST_USER.id,
  email: TEST_USER.email,
  name: TEST_USER.name,
  stripeCustomerId: null,
}) {
  return installSqlRouter(pg, [
    { match: /^\s*UPDATE "User"/, rows: [] },
    { match: /FROM "User"/, rows: user ? [user] : [] },
  ]);
}

const post = (body: unknown) => POST(jsonRequest(URL_, "POST", body));

beforeEach(() => {
  vi.clearAllMocks();
  mockSession(auth, TEST_USER);
  stripeMock.customersCreate.mockResolvedValue({ id: "cus_test_fake_0001" });
  stripeMock.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_fake_0001" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AC-006 (b) checkout 拒絕非 production 的 sk_live_ 金鑰", () => {
  it("AC-006 sk_live_ 金鑰回 503，不建立 Stripe 用戶端、不查資料庫", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_LIVE_KEY);
    const router = db();
    const res = await post({ plan: "pro" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/非 production 環境不得使用 Stripe 正式金鑰/);
    expect(stripeMock.ctor).not.toHaveBeenCalled();
    expect(stripeMock.customersCreate).not.toHaveBeenCalled();
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(router.calls).toHaveLength(0);
  });

  it("AC-006 rk_live_（受限的正式金鑰）同樣被拒絕", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_RESTRICTED_LIVE_KEY);
    db();
    expect((await post({ plan: "pro" })).status).toBe(503);
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it("AC-006 沒有設定金鑰回 503", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    db();
    expect((await post({ plan: "pro" })).status).toBe(503);
    expect(stripeMock.ctor).not.toHaveBeenCalled();
  });
});

describe("AC-006 checkout 測試模式的基本行為", () => {
  it("AC-006 以測試金鑰建立訂閱結帳，metadata 帶 userId 與方案", async () => {
    const router = db();
    const res = await post({ plan: "pro" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_fake_0001" });
    expect(stripeMock.ctor).toHaveBeenCalledWith("sk_test_dummy_placeholder", expect.anything());
    expect(stripeMock.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_test_fake_0001",
        line_items: [{ price: "price_dummy_pro", quantity: 1 }],
        metadata: { userId: TEST_USER.id, plan: "pro" },
        subscription_data: { metadata: { userId: TEST_USER.id, plan: "pro" } },
      }),
    );
    expect(router.find(/^\s*UPDATE "User"/)[0].params).toEqual(["cus_test_fake_0001", TEST_USER.id]);
  });

  it("AC-006 Business 方案使用 STRIPE_PRICE_BUSINESS", async () => {
    db();
    await post({ plan: "business" });
    expect(stripeMock.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_dummy_business", quantity: 1 }] }),
    );
  });

  it("AC-006 已有 stripeCustomerId 時不重複建立 customer", async () => {
    db({ id: TEST_USER.id, email: TEST_USER.email, name: null, stripeCustomerId: "cus_test_fake_existing" });
    await post({ plan: "pro" });
    expect(stripeMock.customersCreate).not.toHaveBeenCalled();
    expect(stripeMock.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_test_fake_existing" }),
    );
  });

  it("AC-006 無效的方案回 400，不呼叫 Stripe", async () => {
    db();
    for (const plan of ["free", "enterprise", "", undefined, 123]) {
      expect((await post({ plan })).status).toBe(400);
    }
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it("AC-006 未登入回 401", async () => {
    mockSession(auth, null);
    db();
    expect((await post({ plan: "pro" })).status).toBe(401);
    expect(stripeMock.ctor).not.toHaveBeenCalled();
  });

  it("AC-006 使用者不存在回 404", async () => {
    db(null);
    expect((await post({ plan: "pro" })).status).toBe(404);
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });
});
