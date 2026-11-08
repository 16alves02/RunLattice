import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { getAppOrigin, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkout"), plan: z.enum(["pro", "team", "business"]), interval: z.enum(["month", "year"]).default("month") }),
  z.object({ action: z.literal("portal") }),
]);

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace owner or administrator permission required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid billing action." }, { status: 400 });

  try {
    const stripe = getStripe();
    const origin = getAppOrigin(request.url);

    if (parsed.data.action === "portal") {
      const customer = await prisma.billingCustomer.findUnique({
        where: { organizationId: access.context.organizationId },
      });
      if (!customer) return NextResponse.json({ error: "No Stripe customer exists for this workspace yet." }, { status: 404 });
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.stripeCustomerId,
        return_url: `${origin}/billing`,
      });
      return NextResponse.json({ url: session.url });
    }

    const prices = {
      pro: { month: process.env.STRIPE_PRICE_PRO_MONTHLY, year: process.env.STRIPE_PRICE_PRO_ANNUAL },
      team: { month: process.env.STRIPE_PRICE_TEAM_MONTHLY, year: process.env.STRIPE_PRICE_TEAM_ANNUAL },
      business: { month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY, year: process.env.STRIPE_PRICE_BUSINESS_ANNUAL },
    } as const;
    const priceId = prices[parsed.data.plan][parsed.data.interval];
    if (!priceId?.startsWith("price_")) {
      return NextResponse.json({ error: "The selected plan is not configured in Stripe yet." }, { status: 503 });
    }

    const [user, organization, existingSubscription] = await Promise.all([
      prisma.user.findUnique({ where: { id: access.context.userId }, select: { email: true } }),
      prisma.organization.findUnique({ where: { id: access.context.organizationId }, select: { name: true } }),
      prisma.billingSubscription.findUnique({ where: { organizationId: access.context.organizationId } }),
    ]);
    if (!organization) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    if (existingSubscription && ["active", "trialing", "past_due"].includes(existingSubscription.status)) {
      return NextResponse.json({ error: "This workspace already has a subscription. Use the billing portal." }, { status: 409 });
    }

    let customer = await prisma.billingCustomer.findUnique({ where: { organizationId: access.context.organizationId } });
    if (!customer) {
      const stripeCustomer = await stripe.customers.create({
        ...(user?.email ? { email: user.email } : {}),
        name: organization.name,
        metadata: { organizationId: access.context.organizationId },
      }, { idempotencyKey: `runlattice-customer-${access.context.organizationId}` });
      customer = await prisma.billingCustomer.upsert({
        where: { organizationId: access.context.organizationId },
        create: { organizationId: access.context.organizationId, stripeCustomerId: stripeCustomer.id },
        update: { stripeCustomerId: stripeCustomer.id },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "always",
      customer: customer.stripeCustomerId,
      client_reference_id: access.context.organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      ...(process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true" ? { automatic_tax: { enabled: true } } : {}),
      customer_update: { address: "auto", name: "auto" },
      metadata: { organizationId: access.context.organizationId, plan: parsed.data.plan, billingInterval: parsed.data.interval },
      subscription_data: {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: { organizationId: access.context.organizationId, plan: parsed.data.plan, billingInterval: parsed.data.interval },
      },
    });
    if (!session.url) return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing] Request failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Billing is temporarily unavailable. Check the Stripe configuration." }, { status: 503 });
  }
}
