import type { PrismaClient } from "@prisma/client";

type UsageDatabase = Pick<PrismaClient, "aiWorkspaceUsage" | "aiUsageEvent" | "$transaction">;

export interface AIUsageLimits {
  monthlyRequests: number;
  monthlyTokens: number;
}

export interface AIUsageReservation {
  eventId: string;
  organizationId: string;
  periodStart: Date;
  reservedTokens: number;
}

const DEFAULT_LIMITS: AIUsageLimits = {
  monthlyRequests: 100,
  monthlyTokens: 100_000,
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAIUsageLimits(): AIUsageLimits {
  return {
    monthlyRequests: positiveInteger(process.env.AI_MONTHLY_REQUEST_LIMIT, DEFAULT_LIMITS.monthlyRequests),
    monthlyTokens: positiveInteger(process.env.AI_MONTHLY_TOKEN_LIMIT, DEFAULT_LIMITS.monthlyTokens),
  };
}

export function getUsagePeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function estimateReservedTokens(prompt: string, maxOutputTokens = 1_200) {
  // A conservative character-based estimate plus fixed system/catalog overhead.
  return Math.ceil(prompt.length / 3) + 1_800 + maxOutputTokens;
}

export async function reserveAIUsage(
  database: UsageDatabase,
  input: {
    organizationId: string;
    userId: string;
    provider: string;
    model: string;
    reservedTokens: number;
    limits?: AIUsageLimits;
    now?: Date;
  },
): Promise<AIUsageReservation | null> {
  const limits = input.limits ?? getAIUsageLimits();
  const periodStart = getUsagePeriodStart(input.now);
  if (input.reservedTokens > limits.monthlyTokens) return null;

  return database.$transaction(async (transaction) => {
    await transaction.aiWorkspaceUsage.upsert({
      where: { organizationId_periodStart: { organizationId: input.organizationId, periodStart } },
      create: { organizationId: input.organizationId, periodStart },
      update: {},
    });

    const reserved = await transaction.aiWorkspaceUsage.updateMany({
      where: {
        organizationId: input.organizationId,
        periodStart,
        requestsUsed: { lt: limits.monthlyRequests },
        tokensUsed: { lte: limits.monthlyTokens - input.reservedTokens },
      },
      data: {
        requestsUsed: { increment: 1 },
        tokensUsed: { increment: input.reservedTokens },
      },
    });
    if (reserved.count !== 1) return null;

    const event = await transaction.aiUsageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        provider: input.provider,
        model: input.model,
        reservedTokens: input.reservedTokens,
      },
      select: { id: true },
    });

    return {
      eventId: event.id,
      organizationId: input.organizationId,
      periodStart,
      reservedTokens: input.reservedTokens,
    };
  });
}

export async function settleAIUsage(
  database: UsageDatabase,
  reservation: AIUsageReservation,
  usage: { promptTokens: number; completionTokens: number },
) {
  const actualTokens = Math.max(0, usage.promptTokens) + Math.max(0, usage.completionTokens);
  await database.$transaction(async (transaction) => {
    const difference = actualTokens - reservation.reservedTokens;
    await transaction.aiWorkspaceUsage.updateMany({
      where: { organizationId: reservation.organizationId, periodStart: reservation.periodStart },
      data: difference >= 0
        ? { tokensUsed: { increment: difference } }
        : { tokensUsed: { decrement: Math.abs(difference) } },
    });
    await transaction.aiUsageEvent.update({
      where: { id: reservation.eventId },
      data: {
        status: "SUCCEEDED",
        promptTokens: Math.max(0, usage.promptTokens),
        completionTokens: Math.max(0, usage.completionTokens),
      },
    });
  });
}

export async function releaseAIUsage(database: UsageDatabase, reservation: AIUsageReservation) {
  await database.$transaction(async (transaction) => {
    await transaction.aiWorkspaceUsage.updateMany({
      where: { organizationId: reservation.organizationId, periodStart: reservation.periodStart },
      data: { tokensUsed: { decrement: reservation.reservedTokens } },
    });
    await transaction.aiUsageEvent.update({
      where: { id: reservation.eventId },
      data: { status: "FAILED" },
    });
  });
}
