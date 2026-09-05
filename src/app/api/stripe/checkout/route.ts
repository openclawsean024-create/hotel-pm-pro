// app/api/stripe/checkout/route.ts (用 pg)
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { pgQuery, pgQueryOne } from "@/lib/pg-client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { plan } = await req.json();
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: "無效的方案" }, { status: 400 });
  }

  let user = await pgQueryOne<any>(
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

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pricing?canceled=1`,
    metadata: { userId: user.id, plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
