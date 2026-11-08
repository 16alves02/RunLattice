export type BillingPlan = "free" | "pro" | "team" | "business";

export interface PlanLimits {
  workflows: number;
  monthlyRuns: number;
  members: number;
  integrations: number;
  aiRequests: number;
  aiTokens: number;
  historyDays: number;
  concurrentRuns: number;
}

// Internal "team" remains the Stripe plan key; the customer-facing name is "Teams".
export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  free: {
    workflows: 3,
    monthlyRuns: 100,
    members: 1,
    integrations: 1,
    aiRequests: 10,
    aiTokens: 20_000,
    historyDays: 7,
    concurrentRuns: 1,
  },
  pro: {
    workflows: 20,
    monthlyRuns: 1_000,
    members: 1,
    integrations: 5,
    aiRequests: 100,
    aiTokens: 200_000,
    historyDays: 30,
    concurrentRuns: 2,
  },
  team: {
    workflows: 100,
    monthlyRuns: 5_000,
    members: 5,
    integrations: 15,
    aiRequests: 400,
    aiTokens: 800_000,
    historyDays: 90,
    concurrentRuns: 5,
  },
  business: {
    workflows: 500,
    monthlyRuns: 20_000,
    members: 15,
    integrations: 50,
    aiRequests: 1_200,
    aiTokens: 2_400_000,
    historyDays: 180,
    concurrentRuns: 10,
  },
};

export type SubscriptionSnapshot = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
};

export function resolveEntitledPlan(subscription: SubscriptionSnapshot | null | undefined, now = new Date()): BillingPlan {
  if (!subscription) return "free";
  if (!["active", "trialing", "past_due"].includes(subscription.status)) return "free";
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= now.getTime()) return "free";
  if (subscription.plan === "pro" || subscription.plan === "team" || subscription.plan === "business") {
    return subscription.plan;
  }
  return "free";
}
