import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/billing";

export const runtime = "nodejs";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return customer ? (typeof customer === "string" ? customer : customer.id) : null;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId || session.client_reference_id;
      const stripeCustomerId = customerId(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!organizationId || !stripeCustomerId || !subscriptionId) return;
      await prisma.billingCustomer.upsert({
        where: { organizationId },
        create: { organizationId, stripeCustomerId },
        update: { stripeCustomerId },
      });
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(subscription, organizationId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
      return;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = customerId(invoice.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      if (stripeCustomerId) {
        await prisma.billingSubscription.updateMany({
          where: { stripeCustomerId },
          data: { status: "past_due" },
        });
      }
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.warn("[billing] Invalid Stripe webhook signature:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const previous = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (previous?.processedAt) return NextResponse.json({ received: true, duplicate: true });

    await prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, type: event.type },
      update: {},
    });
    await handleEvent(event);
    await prisma.stripeEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing] Stripe event processing failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed. Stripe may retry this event." }, { status: 500 });
  }
}
