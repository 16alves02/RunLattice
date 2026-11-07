export type BillingPlan = "free" | "pro" | "team";

export const PLAN_LIMITS: Record<BillingPlan, {
  workflows: number;
  monthlyRuns: number;
  members: number;
  aiRequests: number;
}> = {
  free: { workflows: 3, monthlyRuns: 100, members: 1, aiRequests: 0 },
  pro: { workflows: 25, monthlyRuns: 5_000, members: 3, aiRequests: 100 },
  team: { workflows: 100, monthlyRuns: 25_000, members: 10, aiRequests: 500 },
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
  if (subscription.plan === "pro" || subscription.plan === "team") return subscription.plan;
  return "free";
}
