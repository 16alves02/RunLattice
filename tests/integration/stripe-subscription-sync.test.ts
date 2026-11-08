import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { POST } from "../../src/app/api/billing/webhook/route";
import { prisma } from "../../src/lib/prisma";

const stripe = new Stripe("sk_test_runlattice_integration_key");
const webhookSecret = "whsec_runlattice_subscription_sync_test";

function subscriptionEvent(input: {
  eventId: string;
  subscriptionId: string;
  customerId: string;
  organizationId: string;
  priceId: string;
  interval: "month" | "year";
}) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    id: input.eventId,
    object: "event",
    api_version: "2026-10-29",
    created: now,
    data: {
      object: {
        id: input.subscriptionId,
        object: "subscription",
        customer: input.customerId,
        status: "active",
        metadata: { organizationId: input.organizationId, plan: "pro" },
        cancel_at_period_end: false,
        trial_end: null,
        items: {
          object: "list",
          data: [{
            id: `si_${input.subscriptionId}`,
            object: "subscription_item",
            price: {
              id: input.priceId,
              object: "price",
              recurring: { interval: input.interval, interval_count: 1 },
            },
            current_period_start: now,
            current_period_end: now + (input.interval === "year" ? 31_536_000 : 2_592_000),
          }],
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "customer.subscription.created",
  });
}

async function deliver(payload: string) {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return POST(new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  }));
}

describe("Stripe subscription synchronization", () => {
  let organizationId: string | undefined;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_runlattice_integration_key";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_test_pro_month";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_test_pro_year";
  });

  afterEach(async () => {
    if (organizationId) {
      await prisma.stripeEvent.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      organizationId = undefined;
    }
  });

  it("maps signed monthly and annual Stripe subscription events to the selected Pro plan", async () => {
    organizationId = randomUUID();
    await prisma.organization.create({
      data: { id: organizationId, name: "Billing integration test", slug: `billing-${organizationId}` },
    });

    const monthlyEventId = `evt_monthly_${randomUUID()}`;
    const monthlyResponse = await deliver(subscriptionEvent({
      eventId: monthlyEventId,
      subscriptionId: `sub_monthly_${randomUUID()}`,
      customerId: `cus_${randomUUID()}`,
      organizationId,
      priceId: "price_test_pro_month",
      interval: "month",
    }));
    expect(monthlyResponse.status).toBe(200);

    let subscription = await prisma.billingSubscription.findUnique({ where: { organizationId } });
    expect(subscription).toMatchObject({ plan: "pro", billingInterval: "month", status: "active" });

    const annualEventId = `evt_annual_${randomUUID()}`;
    const annualResponse = await deliver(subscriptionEvent({
      eventId: annualEventId,
      subscriptionId: `sub_annual_${randomUUID()}`,
      customerId: `cus_annual_${randomUUID()}`,
      organizationId,
      priceId: "price_test_pro_year",
      interval: "year",
    }));
    expect(annualResponse.status).toBe(200);

    subscription = await prisma.billingSubscription.findUnique({ where: { organizationId } });
    expect(subscription).toMatchObject({ plan: "pro", billingInterval: "year", status: "active" });
    expect(subscription?.stripePriceId).toBe("price_test_pro_year");
  });
});
