// app/api/stripe/checkout/route.ts — 建立 Stripe Checkout Session（AC-006，FR-022；僅測試模式）
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";
import { getStripe, isPaidPlan, priceIdForPlan, StripeConfigError } from "@/lib/stripe";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  // 金鑰防呆：非 production 環境拿到 sk_live_ 金鑰時拒絕執行（不呼叫 Stripe、不查資料庫）。
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  let body: { plan?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON 內容" }, { status: 400 });
  }
  const plan = body?.plan;
  const priceId = isPaidPlan(plan) ? priceIdForPlan(plan) : null;
  if (!isPaidPlan(plan) || !priceId) {
    return NextResponse.json({ error: "無效的方案" }, { status: 400 });
  }

  const user = await pgQueryOne<{ id: string; email: string; name: string | null; stripeCustomerId: string | null }>(
    `SELECT id, email, name, "stripeCustomerId" FROM "User" WHERE id = $1`,
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "使用者不存在" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await pgQuery(
      `UPDATE "User" SET "stripeCustomerId" = $1 WHERE id = $2`,
      [customerId, user.id]
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/pricing?canceled=1`,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
