// AC-006 (b) Stripe 金鑰防呆的單元測試
import { describe, expect, it } from "vitest";
import {
  assertStripeKeyAllowed,
  isLiveStripeKey,
  isProductionEnv,
  planFromPriceId,
  priceIdForPlan,
  StripeConfigError,
} from "@/lib/stripe";

const FAKE_LIVE_KEY = ["sk", "live", "dummyplaceholder"].join("_");
const TEST_KEY = "sk_test_dummy_placeholder";

describe("AC-006 (b) assertStripeKeyAllowed", () => {
  it("AC-006 測試金鑰在任何環境都可用", () => {
    expect(assertStripeKeyAllowed({ STRIPE_SECRET_KEY: TEST_KEY, NODE_ENV: "development" })).toBe(TEST_KEY);
    expect(assertStripeKeyAllowed({ STRIPE_SECRET_KEY: TEST_KEY, NODE_ENV: "production" })).toBe(TEST_KEY);
  });

  it("AC-006 sk_live_ 在 development／test 環境被拒絕", () => {
    for (const NODE_ENV of ["development", "test", undefined]) {
      expect(() => assertStripeKeyAllowed({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY, NODE_ENV })).toThrow(StripeConfigError);
    }
  });

  it("AC-006 sk_live_ 在 Vercel preview 部署（NODE_ENV 雖是 production）也被拒絕", () => {
    expect(() =>
      assertStripeKeyAllowed({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY, NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toThrow(/非 production 環境不得使用 Stripe 正式金鑰/);
  });

  it("AC-006 只有 production 環境不擋 sk_live_（切換正式模式仍需 Sean 人審）", () => {
    expect(
      assertStripeKeyAllowed({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY, NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).toBe(FAKE_LIVE_KEY);
  });

  it("AC-006 沒有金鑰時拋 StripeConfigError", () => {
    expect(() => assertStripeKeyAllowed({ NODE_ENV: "test" })).toThrow(/尚未設定 STRIPE_SECRET_KEY/);
  });

  it("AC-006 錯誤訊息不含金鑰內容", () => {
    try {
      assertStripeKeyAllowed({ STRIPE_SECRET_KEY: FAKE_LIVE_KEY, NODE_ENV: "test" });
      throw new Error("應該要拋錯");
    } catch (err) {
      expect((err as Error).message).not.toContain("dummyplaceholder");
    }
  });
});

describe("AC-006 環境與方案對應", () => {
  it("AC-006 isProductionEnv：有 VERCEL_ENV 時以它為準", () => {
    expect(isProductionEnv({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionEnv({})).toBe(false);
  });

  it("AC-006 isLiveStripeKey 只認 sk_live_ 與 rk_live_", () => {
    expect(isLiveStripeKey(FAKE_LIVE_KEY)).toBe(true);
    expect(isLiveStripeKey(["rk", "live", "dummyplaceholder"].join("_"))).toBe(true);
    expect(isLiveStripeKey(TEST_KEY)).toBe(false);
  });

  it("AC-006 price id 與方案互相對應；未知的 price 回 null", () => {
    const env = { STRIPE_PRICE_PRO: "price_dummy_pro", STRIPE_PRICE_BUSINESS: "price_dummy_business" };
    expect(priceIdForPlan("pro", env)).toBe("price_dummy_pro");
    expect(priceIdForPlan("business", env)).toBe("price_dummy_business");
    expect(priceIdForPlan("pro", {})).toBeNull();
    expect(planFromPriceId("price_dummy_pro", env)).toBe("pro");
    expect(planFromPriceId("price_dummy_business", env)).toBe("business");
    expect(planFromPriceId("price_unknown_fake", env)).toBeNull();
    expect(planFromPriceId(null, env)).toBeNull();
    expect(planFromPriceId("", {})).toBeNull();
  });
});
