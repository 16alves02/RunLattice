import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { POST } from "../../src/app/api/billing/webhook/route";
import { prisma } from "../../src/lib/prisma";

const stripe = new Stripe("sk_test_runlattice_integration_key");

function makePayload(id: string) {
  return JSON.stringify({
    id,
    object: "event",
    api_version: "2026-10-29",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "ch_test_runlattice", object: "charge" } },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "charge.succeeded",
  });
}

describe("Stripe webhook verification and idempotency", () => {
  const eventIds: string[] = [];

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_runlattice_integration_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_runlattice_integration_secret";
  });

  afterEach(async () => {
    if (eventIds.length) {
      await prisma.stripeEvent.deleteMany({ where: { id: { in: eventIds } } });
      eventIds.length = 0;
    }
  });

  it("accepts a valid signature once and acknowledges duplicate delivery", async () => {
    const eventId = \`evt_runlattice_\${randomUUID()}\`;
    eventIds.push(eventId);
    const payload = makePayload(eventId);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });

    const first = await POST(new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    }));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ received: true });

    const second = await POST(new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    }));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ received: true, duplicate: true });

    const stored = await prisma.stripeEvent.findUnique({ where: { id: eventId } });
    expect(stored?.processedAt).toBeInstanceOf(Date);
  });

  it("rejects a request with an invalid signature", async () => {
    const payload = makePayload(\`evt_invalid_\${randomUUID()}\`);
    const response = await POST(new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=invalid" },
      body: payload,
    }));
    expect(response.status).toBe(400);
  });
});
