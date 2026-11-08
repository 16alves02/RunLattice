import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, resolveEntitledPlan, type BillingPlan } from "@/lib/billing-core";

function fromUnixTimestamp(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export function getBillingPeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getWorkspaceEntitlements(organizationId: string, now = new Date()) {
  const periodStart = getBillingPeriodStart(now);
  const [subscription, activeWorkflows, monthlyRuns, members, integrations, aiUsage] = await Promise.all([
    prisma.billingSubscription.findUnique({ where: { organizationId } }),
    prisma.workflow.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.workflowRun.count({ where: { workflow: { organizationId }, createdAt: { gte: periodStart } } }),
    prisma.member.count({ where: { organizationId } }),
    prisma.integrationConnection.count({ where: { organizationId } }),
    prisma.aiWorkspaceUsage.findUnique({
      where: { organizationId_periodStart: { organizationId, periodStart } },
      select: { requestsUsed: true, creditsUsed: true, tokensUsed: true },
    }),
  ]);
  const plan = resolveEntitledPlan(subscription, now);
  const limits = PLAN_LIMITS[plan];
  const usage = {
    activeWorkflows,
    monthlyRuns,
    members,
    integrations,
    aiRequests: aiUsage?.requestsUsed ?? 0,
    aiCredits: aiUsage?.creditsUsed ?? 0,
    aiTokens: aiUsage?.tokensUsed ?? 0,
  };
  return {
    plan,
    limits,
    usage,
    subscription,
    canActivateWorkflow: activeWorkflows < limits.workflows,
    canRunWorkflow: monthlyRuns < limits.monthlyRuns,
    canInviteMember: members < limits.members,
    canConnectIntegration: integrations < limits.integrations,
  };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, knownOrganizationId?: string) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const existingCustomer = await prisma.billingCustomer.findUnique({ where: { stripeCustomerId: customerId } });
  const organizationId = existingCustomer?.organizationId || knownOrganizationId || subscription.metadata.organizationId;
  if (!organizationId) throw new Error("Stripe subscription is not associated with a RunLattice workspace.");

  if (!existingCustomer) {
    await prisma.billingCustomer.upsert({
      where: { organizationId },
      create: { organizationId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const billingItem = subscription.items.data[0];
  const priceId = billingItem?.price.id;
  if (!priceId) throw new Error("Stripe subscription has no recurring price.");
  const pricePlan: Record<string, BillingPlan> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "pro",
    [process.env.STRIPE_PRICE_PRO_ANNUAL ?? ""]: "pro",
    [process.env.STRIPE_PRICE_TEAM_MONTHLY ?? ""]: "team",
    [process.env.STRIPE_PRICE_TEAM_ANNUAL ?? ""]: "team",
    [process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? ""]: "business",
    [process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? ""]: "business",
  };
  const mappedPlan = pricePlan[priceId];
  const metadataPlan = subscription.metadata.plan;
  // Never grant paid entitlements from metadata alone. A signed event must
  // reference an explicitly configured Price ID for this exact RunLattice plan.
  if (!mappedPlan || (metadataPlan && mappedPlan !== metadataPlan)) {
    throw new Error("Stripe subscription uses a price that is not mapped to its RunLattice plan.");
  }
  const plan: BillingPlan = mappedPlan;
  const billingInterval = billingItem?.price.recurring?.interval === "year" ? "year" : "month";

  await prisma.billingSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      billingInterval,
      plan,
      status: subscription.status,
      currentPeriodStart: fromUnixTimestamp(billingItem?.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(billingItem?.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: fromUnixTimestamp(subscription.trial_end),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      billingInterval,
      plan,
      status: subscription.status,
      currentPeriodStart: fromUnixTimestamp(billingItem?.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(billingItem?.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: fromUnixTimestamp(subscription.trial_end),
    },
  });
}
