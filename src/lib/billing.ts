import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, resolveEntitledPlan, type BillingPlan } from "@/lib/billing-core";

function fromUnixTimestamp(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export async function getWorkspaceEntitlements(organizationId: string, now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [subscription, workflows, monthlyRuns, members] = await Promise.all([
    prisma.billingSubscription.findUnique({ where: { organizationId } }),
    prisma.workflow.count({ where: { organizationId } }),
    prisma.workflowRun.count({ where: { workflow: { organizationId }, createdAt: { gte: periodStart } } }),
    prisma.member.count({ where: { organizationId } }),
  ]);
  const plan = resolveEntitledPlan(subscription, now);
  const limits = PLAN_LIMITS[plan];
  return {
    plan,
    limits,
    usage: { workflows, monthlyRuns, members },
    subscription,
    canCreateWorkflow: workflows < limits.workflows,
    canRunWorkflow: monthlyRuns < limits.monthlyRuns,
    canInviteMember: members < limits.members,
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

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Stripe subscription has no recurring price.");
  const metadataPlan = subscription.metadata.plan;
  const plan: BillingPlan | null = metadataPlan === "pro" || metadataPlan === "team"
    ? metadataPlan
    : priceId === process.env.STRIPE_PRICE_PRO_MONTHLY
      ? "pro"
      : priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY
        ? "team"
        : null;
  if (!plan) throw new Error("Stripe subscription uses a price that is not mapped to a RunLattice plan.");

  await prisma.billingSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      plan,
      status: subscription.status,
      currentPeriodStart: fromUnixTimestamp(subscription.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: fromUnixTimestamp(subscription.trial_end),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      plan,
      status: subscription.status,
      currentPeriodStart: fromUnixTimestamp(subscription.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: fromUnixTimestamp(subscription.trial_end),
    },
  });
}
