// lib/stripe.ts — Stripe 用戶端與金鑰防呆（AC-006，FR-022／FR-023）
//
// 規則：
//   - 金鑰只從環境變數讀取，不寫在程式裡。
//   - 非 production 環境若拿到正式金鑰（sk_live_／rk_live_），一律拒絕建立用戶端。
//   - 用戶端在處理請求時才建立（不在模組載入時建立），build 階段不需要金鑰。
import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-07-29.dahlia";

export type PaidPlan = "pro" | "business";

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

type Env = Record<string, string | undefined>;

/** 是否為正式環境。Vercel 上以 VERCEL_ENV 為準（preview 部署的 NODE_ENV 也是 production）。 */
export function isProductionEnv(env: Env = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

export function isLiveStripeKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/** 檢查金鑰是否可用；不可用時拋 StripeConfigError（訊息不含金鑰內容）。 */
export function assertStripeKeyAllowed(env: Env = process.env): string {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeConfigError("尚未設定 STRIPE_SECRET_KEY");
  }
  if (isLiveStripeKey(key) && !isProductionEnv(env)) {
    throw new StripeConfigError("非 production 環境不得使用 Stripe 正式金鑰（sk_live_），已拒絕執行");
  }
  return key;
}

export function getStripe(env: Env = process.env): Stripe {
  return new Stripe(assertStripeKeyAllowed(env), { apiVersion: STRIPE_API_VERSION });
}

export function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === "pro" || plan === "business";
}

export function priceIdForPlan(plan: PaidPlan, env: Env = process.env): string | null {
  const id = plan === "pro" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BUSINESS;
  return id || null;
}

/** 由 Stripe price id 反查方案；不是我們設定的 price 回 null。 */
export function planFromPriceId(priceId: string | null | undefined, env: Env = process.env): PaidPlan | null {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (env.STRIPE_PRICE_BUSINESS && priceId === env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}

/** 從 Stripe 取得訂閱的最新狀態（webhook 以這份為準，不信任事件內容的順序）。 */
export function fetchSubscription(stripe: Stripe, subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}
