import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/billing";

export const runtime = "nodejs";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return customer ? (typeof customer === "string" ? customer : customer.id) : null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const current = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  };
  const value = current.parent?.subscription_details?.subscription ?? current.subscription;
  return typeof value === "string" ? value : value?.id ?? null;
}

async function organizationForCustomer(stripeCustomerId: string | null) {
  if (!stripeCustomerId) return null;
  const customer = await prisma.billingCustomer.findUnique({
    where: { stripeCustomerId },
    select: { organizationId: true },
  });
  return customer?.organizationId ?? null;
}

async function handleEvent(event: Stripe.Event): Promise<{
  organizationId?: string | null;
  objectId?: string | null;
  actionRequired?: boolean;
}> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId || session.client_reference_id;
      const stripeCustomerId = customerId(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!organizationId || !stripeCustomerId || !subscriptionId) return {};
      await prisma.billingCustomer.upsert({
        where: { organizationId },
        create: { organizationId, stripeCustomerId },
        update: { stripeCustomerId },
      });
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(subscription, organizationId);
      return { organizationId, objectId: subscriptionId };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(subscription);
      const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: subscription.id,
      };
    }
    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: subscription.id,
        actionRequired: true,
      };
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      const stripeCustomerId = customerId(invoice.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await syncStripeSubscription(subscription);
      }
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: invoice.id,
      };
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = customerId(invoice.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      const organizationId = await organizationForCustomer(stripeCustomerId);
      if (stripeCustomerId) {
        await prisma.billingSubscription.updateMany({
          where: { stripeCustomerId },
          data: { status: "past_due" },
        });
      }
      return { organizationId, objectId: invoice.id, actionRequired: true };
    }
    case "charge.dispute.created": {
      const charge = event.data.object as Stripe.Charge;
      const stripeCustomerId = customerId(charge.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: charge.id,
        actionRequired: true,
      };
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const stripeCustomerId = customerId(charge.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: charge.id,
        actionRequired: charge.amount_refunded > 0,
      };
    }
    case "radar.early_fraud_warning.created": {
      const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
      const charge = await getStripe().charges.retrieve(warning.charge as string);
      const stripeCustomerId = customerId(charge.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      return {
        organizationId: await organizationForCustomer(stripeCustomerId),
        objectId: warning.id,
        actionRequired: true,
      };
    }
    default:
      return {};
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
      create: { id: event.id, type: event.type, objectId: (event.data.object as { id?: string }).id ?? null },
      update: {},
    });
    const context = await handleEvent(event);
    await prisma.stripeEvent.update({
      where: { id: event.id },
      data: {
        ...(context.organizationId ? { organizationId: context.organizationId } : {}),
        ...(context.objectId ? { objectId: context.objectId } : {}),
        actionRequired: context.actionRequired ?? false,
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing] Stripe event processing failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed. Stripe may retry this event." }, { status: 500 });
  }
}
