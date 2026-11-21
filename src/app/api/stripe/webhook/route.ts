// app/api/stripe/webhook/route.ts — Stripe webhook（AC-006，FR-023）
//
// 流程：金鑰防呆 → 驗證簽章 → 事件冪等（StripeEvent 表）→ 處理事件。
// 同一個事件（event.id）重送時不會重複處理，直接回 200。
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { withTransaction } from "@/lib/pg-client";
import { fetchSubscription, getStripe, isProductionEnv, StripeConfigError } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-webhook";

export async function POST(req: Request) {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "尚未設定 STRIPE_WEBHOOK_SECRET" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    // 不記錄 payload 或簽章內容。
    console.error("[stripe webhook] 簽章驗證失敗");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 非 production 環境只處理測試模式事件。
  if (event.livemode && !isProductionEnv()) {
    return NextResponse.json({ error: "非 production 環境不處理正式模式事件" }, { status: 400 });
  }

  // 冪等：在同一個交易裡先以 event.id 佔位、再處理事件。
  //   - 已存在 → 這個事件處理過，直接回 200 duplicate。
  //   - 處理失敗或程序中途被終止 → 交易回滾，佔位一起消失，Stripe 重送時可以重新處理。
  //   - 兩次遞送同時到達 → 後到的 INSERT 會等前一個交易結束，再得到 duplicate 或接手處理。
  try {
    const outcome = await withTransaction(async (db) => {
      const claimed = await db.queryOne<{ id: string }>(
        `INSERT INTO "StripeEvent" (id, type, "processedAt")
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [event.id, event.type]
      );
      if (!claimed) return { duplicate: true as const };
      const result = await handleStripeEvent(event, {
        db,
        retrieveSubscription: (id) => fetchSubscription(stripe, id),
      });
      return { duplicate: false as const, handled: result.handled };
    });
    if (outcome.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ received: true, handled: outcome.handled });
  } catch (err) {
    // 回 500 讓 Stripe 重送；不記錄 payload。
    console.error(
      `[stripe webhook] 處理 ${event.type} 失敗：`,
      err instanceof Error ? err.message : "unknown"
    );
    return NextResponse.json({ error: "處理失敗" }, { status: 500 });
  }
}
