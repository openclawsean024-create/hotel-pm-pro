// app/api/stripe/webhook/route.ts — Stripe webhook（AC-006，FR-023）
//
// 流程：金鑰防呆 → 驗證簽章 → 事件冪等（StripeEvent 表）→ 處理事件。
// 同一個事件（event.id）重送時不會重複處理，直接回 200。
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";
import { getStripe, isProductionEnv, StripeConfigError } from "@/lib/stripe";
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

  // 冪等：先以 event.id 佔位；已存在代表這個事件處理過（或正在處理），直接回 200。
  let claimed: { id: string } | null;
  try {
    claimed = await pgQueryOne<{ id: string }>(
      `INSERT INTO "StripeEvent" (id, type, "processedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [event.id, event.type]
    );
  } catch (err) {
    console.error("[stripe webhook] 無法記錄事件：", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (err) {
    // 處理失敗：釋放佔位，讓 Stripe 重送時可以重新處理；回 500 觸發重送。
    console.error(
      `[stripe webhook] 處理 ${event.type} 失敗：`,
      err instanceof Error ? err.message : "unknown"
    );
    try {
      await pgQuery(`DELETE FROM "StripeEvent" WHERE id = $1`, [event.id]);
    } catch {
      console.error("[stripe webhook] 無法釋放事件佔位");
    }
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
