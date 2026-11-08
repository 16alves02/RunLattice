import type { PrismaClient } from "@prisma/client";

type UsageDatabase = Pick<PrismaClient, "aiWorkspaceUsage" | "aiUsageEvent" | "$transaction">;

export interface AIUsageLimits {
  monthlyRequests: number;
  monthlyCredits: number;
  monthlyTokens: number;
}

export interface AIUsageReservation {
  eventId: string;
  organizationId: string;
  periodStart: Date;
  reservedTokens: number;
  creditCost: number;
  billingSource: "platform" | "byok";
}

const DEFAULT_LIMITS: AIUsageLimits = {
  monthlyRequests: 1_000,
  monthlyCredits: 1_200,
  monthlyTokens: 2_400_000,
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAIUsageLimits(): AIUsageLimits {
  return {
    monthlyRequests: positiveInteger(process.env.AI_MONTHLY_REQUEST_LIMIT, DEFAULT_LIMITS.monthlyRequests),
    monthlyCredits: positiveInteger(process.env.AI_MONTHLY_CREDIT_LIMIT, DEFAULT_LIMITS.monthlyCredits),
    monthlyTokens: positiveInteger(process.env.AI_MONTHLY_TOKEN_LIMIT, DEFAULT_LIMITS.monthlyTokens),
  };
}

export function getUsagePeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}


export function getAIModelCreditCost(model: string) {
  const configured = process.env.AI_MODEL_CREDIT_COSTS;
  if (configured) {
    try {
      const overrides = JSON.parse(configured) as Record<string, unknown>;
      const value = overrides[model];
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    } catch {
      // Ignore invalid optional overrides and use the safe built-in tiers.
    }
  }
  const normalized = model.toLowerCase();
  if (/(mini|nano|haiku|flash)/.test(normalized)) return 1;
  if (/(opus|\bo[1-9]|reasoner|\bpro\b)/.test(normalized)) return 5;
  return 3;
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
    creditCost?: number;
    limits?: AIUsageLimits;
    now?: Date;
  },
): Promise<AIUsageReservation | null> {
  const limits = input.limits ?? getAIUsageLimits();
  const periodStart = getUsagePeriodStart(input.now);
  const creditCost = input.creditCost ?? 1;
  if (input.reservedTokens > limits.monthlyTokens || creditCost < 1 || creditCost > limits.monthlyCredits) return null;

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
        creditsUsed: { lte: limits.monthlyCredits - creditCost },
        tokensUsed: { lte: limits.monthlyTokens - input.reservedTokens },
      },
      data: {
        requestsUsed: { increment: 1 },
        creditsUsed: { increment: creditCost },
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
        creditCost,
      },
      select: { id: true },
    });

    return {
      eventId: event.id,
      organizationId: input.organizationId,
      periodStart,
      reservedTokens: input.reservedTokens,
      creditCost,
      billingSource: "platform",
    };
  });
}

export async function recordBYOKAIUsage(
  database: UsageDatabase,
  input: {
    organizationId: string;
    userId: string;
    provider: string;
    model: string;
    now?: Date;
  },
): Promise<AIUsageReservation> {
  const event = await database.aiUsageEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      reservedTokens: 0,
      creditCost: 0,
      billingSource: "byok",
    },
    select: { id: true },
  });
  return {
    eventId: event.id,
    organizationId: input.organizationId,
    periodStart: getUsagePeriodStart(input.now),
    reservedTokens: 0,
    creditCost: 0,
    billingSource: "byok",
  };
}

export async function settleAIUsage(
  database: UsageDatabase,
  reservation: AIUsageReservation,
  usage: { promptTokens: number; completionTokens: number },
) {
  const actualTokens = Math.max(0, usage.promptTokens) + Math.max(0, usage.completionTokens);
  await database.$transaction(async (transaction) => {
    if (reservation.billingSource === "platform") {
      const difference = actualTokens - reservation.reservedTokens;
      await transaction.aiWorkspaceUsage.updateMany({
        where: { organizationId: reservation.organizationId, periodStart: reservation.periodStart },
        data: difference >= 0
          ? { tokensUsed: { increment: difference } }
          : { tokensUsed: { decrement: Math.abs(difference) } },
      });
    }
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

export async function markAIUsageFailed(database: UsageDatabase, reservation: AIUsageReservation) {
  // Keep the reservation charged: a provider timeout can occur after the
  // provider accepted and processed the request, so usage is ambiguous.
  await database.aiUsageEvent.update({
    where: { id: reservation.eventId },
    data: { status: "FAILED" },
  });
}
