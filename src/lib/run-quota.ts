import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, resolveEntitledPlan } from "@/lib/billing-core";
import { getBillingPeriodStart } from "@/lib/billing";

type RunQuotaResult<T> =
  | { allowed: true; data: T; used: number; limit: number }
  | { allowed: false; used: number; limit: number };

export async function createQuotaBoundWorkflowRun<T>(input: {
  organizationId: string;
  create: (transaction: Prisma.TransactionClient) => Promise<T>;
  now?: Date;
}): Promise<RunQuotaResult<T>> {
  const now = input.now ?? new Date();
  const periodStart = getBillingPeriodStart(now);

  return prisma.$transaction(async (transaction) => {
    // Serialize run admissions per workspace so simultaneous requests cannot
    // both pass the same final quota slot.
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 0))`;

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

    if (used >= limit) return { allowed: false, used, limit };
    const data = await input.create(transaction);
    return { allowed: true, data, used: used + 1, limit };
  });
}
