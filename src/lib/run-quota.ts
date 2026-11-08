import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, resolveEntitledPlan } from "@/lib/billing-core";
import { getBillingPeriodStart } from "@/lib/billing";

type RunQuotaResult<T> =
  | { allowed: true; data: T; used: number; limit: number }
  | { allowed: false; used: number; limit: number };

export async function admitRunUnderQuota<T>(
  used: number,
  limit: number,
  create: () => Promise<T>,
): Promise<RunQuotaResult<T>> {
  if (used >= limit) return { allowed: false, used, limit };
  const data = await create();
  return { allowed: true, data, used: used + 1, limit };
}

export async function createQuotaBoundWorkflowRun<T>(input: {
  organizationId: string;
  create: (transaction: Prisma.TransactionClient) => Promise<T>;
  now?: Date;
}): Promise<RunQuotaResult<T>> {
  const now = input.now ?? new Date();
  const periodStart = getBillingPeriodStart(now);

  return prisma.$transaction(async (transaction) => {
    // Serialize admissions per workspace to prevent simultaneous requests
    // from consuming the same final monthly execution slot.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 0))::text AS lock_value`;

    const subscription = await transaction.billingSubscription.findUnique({
      where: { organizationId: input.organizationId },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });
    const plan = resolveEntitledPlan(subscription, now);
    const limit = PLAN_LIMITS[plan].monthlyRuns;
    const used = await transaction.workflowRun.count({
      where: {
        workflow: { organizationId: input.organizationId },
        createdAt: { gte: periodStart },
      },
    });

    return admitRunUnderQuota(used, limit, () => input.create(transaction));
  });
}
