// app/api/stripe/webhook/route.ts (用 pg)
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { pgQuery } from "@/lib/pg-client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-07-29.dahlia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await pgQuery(
            `UPDATE "Subscription" SET "stripeSubscriptionId" = $1, plan = $2, status = 'active' WHERE "userId" = $3`,
            [session.subscription as string, plan, userId]
          );
          await pgQuery(
            `UPDATE "User" SET tier = $1 WHERE id = $2`,
            [plan, userId]
          );
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = (sub as any).current_period_end ?? (sub as any).billing_cycle_anchor ?? Date.now() / 1000;
        await pgQuery(
          `UPDATE "Subscription" SET status = $1, "cancelAtPeriodEnd" = $2, "stripeCurrentPeriodEnd" = to_timestamp($3) WHERE "stripeSubscriptionId" = $4`,
          [sub.status, sub.cancel_at_period_end, periodEnd, sub.id]
        );

        if (event.type === "customer.subscription.deleted" && sub.status === "canceled") {
          await pgQuery(
            `UPDATE "User" SET tier = 'free' WHERE "stripeCustomerId" = $1`,
            [sub.customer as string]
          );
          await pgQuery(
            `UPDATE "Subscription" SET plan = 'free' WHERE "stripeSubscriptionId" = $1`,
            [sub.id]
          );
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook DB error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
