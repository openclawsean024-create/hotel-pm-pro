// lib/stripe-webhook.ts — Stripe webhook 事件處理（AC-006，FR-023）
//
// 修正的缺陷（SPEC §5.3 缺陷 3、4）：
//   - checkout.session.completed 以前只 UPDATE，新使用者沒有 Subscription 列時不會建立 → 改為 upsert。
//   - customer.subscription.updated 以前不會把方案升降級同步到 User.tier → 依 price id 同步。
//   - invoice.paid／invoice.payment_failed 以前未處理 → 同步訂閱狀態。
// 每個處理都是「把狀態設成事件描述的樣子」，重複執行結果相同；事件層級的冪等另由 route 以 StripeEvent 表把關。
import type Stripe from "stripe";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";
import { isPaidPlan, planFromPriceId, priceIdForPlan } from "@/lib/stripe";

export interface WebhookResult {
  handled: boolean;
  /** 未處理時的原因（只供記錄，不含個資） */
  reason?: string;
}

const ignored = (reason: string): WebhookResult => ({ handled: false, reason });

function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** 仍享有付費方案的訂閱狀態（past_due 先保留方案，由 Stripe 重試扣款）。 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);
/** 已失去付費方案的訂閱狀態。 */
const ENDED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    case "invoice.paid":
      return handleInvoice(event.data.object as Stripe.Invoice, "paid");
    case "invoice.payment_failed":
      return handleInvoice(event.data.object as Stripe.Invoice, "failed");
    default:
      return ignored(`未處理的事件類型 ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<WebhookResult> {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  if (session.mode !== "subscription") return ignored("不是訂閱結帳");
  if (!userId || !isPaidPlan(plan)) return ignored("缺少 userId 或方案 metadata");
  if (session.payment_status === "unpaid") return ignored("尚未付款");

  const user = await pgQueryOne<{ id: string }>(`SELECT id FROM "User" WHERE id = $1 LIMIT 1`, [userId]);
  if (!user) return ignored("找不到使用者");

  const subscriptionId = idOf(session.subscription as string | { id: string } | null);
  const customerId = idOf(session.customer as string | { id: string } | null);

  // 建立或更新（一位使用者只有一列 Subscription，userId 為 unique）。
  await pgQuery(
    `INSERT INTO "Subscription" (id, "userId", "stripeSubscriptionId", "stripePriceId", plan, status, "cancelAtPeriodEnd", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'active', false, NOW(), NOW())
     ON CONFLICT ("userId") DO UPDATE
       SET "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
           "stripePriceId" = EXCLUDED."stripePriceId",
           plan = EXCLUDED.plan,
           status = 'active',
           "cancelAtPeriodEnd" = false,
           "updatedAt" = NOW()`,
    [generateId(), userId, subscriptionId, priceIdForPlan(plan), plan]
  );
  await pgQuery(
    `UPDATE "User" SET tier = $1, "stripeCustomerId" = COALESCE("stripeCustomerId", $3), "updatedAt" = NOW() WHERE id = $2`,
    [plan, userId, customerId]
  );
  return { handled: true };
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<WebhookResult> {
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const legacy = sub as unknown as { current_period_end?: number };
  const periodEnd =
    (item as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
    legacy.current_period_end ??
    null;

  // 方案：已結束的訂閱降回 free；仍有效的訂閱依 price id 對應方案（不是我們的 price 就維持原方案）。
  let plan: string | null = null;
  if (ENDED_STATUSES.has(sub.status)) plan = "free";
  else if (ENTITLED_STATUSES.has(sub.status)) plan = planFromPriceId(priceId);

  await pgQuery(
    `UPDATE "Subscription"
        SET status = $1,
            "cancelAtPeriodEnd" = $2,
            "stripeCurrentPeriodEnd" = COALESCE(to_timestamp($3::double precision), "stripeCurrentPeriodEnd"),
            "stripePriceId" = COALESCE($4, "stripePriceId"),
            plan = COALESCE($5, plan),
            "updatedAt" = NOW()
      WHERE "stripeSubscriptionId" = $6`,
    [sub.status, sub.cancel_at_period_end ?? false, periodEnd, priceId, plan, sub.id]
  );
  if (plan) {
    // 只更新「目前訂閱就是這一筆」的使用者，避免舊訂閱的事件蓋掉新訂閱的方案。
    await pgQuery(
      `UPDATE "User" SET tier = $1, "updatedAt" = NOW()
        WHERE id IN (SELECT "userId" FROM "Subscription" WHERE "stripeSubscriptionId" = $2)`,
      [plan, sub.id]
    );
  }
  return { handled: true };
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<WebhookResult> {
  await pgQuery(
    `UPDATE "User" SET tier = 'free', "updatedAt" = NOW()
      WHERE id IN (SELECT "userId" FROM "Subscription" WHERE "stripeSubscriptionId" = $1)`,
    [sub.id]
  );
  await pgQuery(
    `UPDATE "Subscription"
        SET status = 'canceled', plan = 'free', "cancelAtPeriodEnd" = false, "updatedAt" = NOW()
      WHERE "stripeSubscriptionId" = $1`,
    [sub.id]
  );
  return { handled: true };
}

async function handleInvoice(invoice: Stripe.Invoice, outcome: "paid" | "failed"): Promise<WebhookResult> {
  const withParent = invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
    subscription?: string | { id: string } | null;
  };
  const subscriptionId =
    idOf(withParent.parent?.subscription_details?.subscription) ?? idOf(withParent.subscription);
  if (!subscriptionId) return ignored("發票沒有對應的訂閱");

  if (outcome === "paid") {
    // 只把逾期中的訂閱恢復為 active；已取消的訂閱不因補繳而復活。
    await pgQuery(
      `UPDATE "Subscription" SET status = 'active', "updatedAt" = NOW()
        WHERE "stripeSubscriptionId" = $1 AND status IN ('past_due', 'incomplete')`,
      [subscriptionId]
    );
  } else {
    await pgQuery(
      `UPDATE "Subscription" SET status = 'past_due', "updatedAt" = NOW()
        WHERE "stripeSubscriptionId" = $1 AND status IN ('active', 'trialing')`,
      [subscriptionId]
    );
  }
  return { handled: true };
}
