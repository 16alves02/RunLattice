import { describe, expect, it, vi } from "vitest";
import {
  estimateReservedTokens,
  getUsagePeriodStart,
  markAIUsageFailed,
  reserveAIUsage,
  settleAIUsage,
} from "@/lib/ai-usage";

function createDatabase(reservationCount = 1) {
  const aiWorkspaceUsage = {
    upsert: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: reservationCount }),
  };
  const aiUsageEvent = {
    create: vi.fn().mockResolvedValue({ id: "event-1" }),
    update: vi.fn().mockResolvedValue({}),
  };
  const transaction = { aiWorkspaceUsage, aiUsageEvent };
  const database = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return { database, transaction };
}

describe("workspace AI usage accounting", () => {
  it("uses a UTC monthly bucket", () => {
    expect(getUsagePeriodStart(new Date("2026-11-05T17:00:00.000Z")).toISOString())
      .toBe("2026-11-01T00:00:00.000Z");
  });

  it("reserves request and token budget atomically before provider calls", async () => {
    const { database, transaction } = createDatabase();
    const result = await reserveAIUsage(database as never, {
      organizationId: "workspace-1",
      userId: "user-1",
      provider: "openai",
      model: "test-model",
      reservedTokens: 2_000,
      limits: { monthlyRequests: 10, monthlyTokens: 10_000 },
      now: new Date("2026-11-05T00:00:00.000Z"),
    });

    expect(result?.eventId).toBe("event-1");
    expect(transaction.aiWorkspaceUsage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        requestsUsed: { lt: 10 },
        tokensUsed: { lte: 8_000 },
      }),
      data: { requestsUsed: { increment: 1 }, tokensUsed: { increment: 2_000 } },
    }));
  });

  it("rejects a reservation when the workspace budget is exhausted", async () => {
    const { database, transaction } = createDatabase(0);
    const result = await reserveAIUsage(database as never, {
      organizationId: "workspace-1",
      userId: "user-1",
      provider: "openai",
      model: "test-model",
      reservedTokens: 2_000,
      limits: { monthlyRequests: 10, monthlyTokens: 10_000 },
    });

    expect(result).toBeNull();
    expect(transaction.aiUsageEvent.create).not.toHaveBeenCalled();
  });

  it("reconciles reserved tokens with provider-reported usage", async () => {
    const { database, transaction } = createDatabase();
    await settleAIUsage(database as never, {
      eventId: "event-1",
      organizationId: "workspace-1",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      reservedTokens: 2_000,
    }, { promptTokens: 600, completionTokens: 400 });

    expect(transaction.aiWorkspaceUsage.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "workspace-1", periodStart: new Date("2026-11-01T00:00:00.000Z") },
      data: { tokensUsed: { decrement: 1_000 } },
    });
    expect(transaction.aiUsageEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: "SUCCEEDED", promptTokens: 600, completionTokens: 400 },
    });
  });

  it("keeps reserved tokens charged when provider outcome is ambiguous", async () => {
    const { database, transaction } = createDatabase();
    await markAIUsageFailed(database as never, {
      eventId: "event-1",
      organizationId: "workspace-1",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      reservedTokens: 2_000,
    });
    expect(transaction.aiWorkspaceUsage.updateMany).not.toHaveBeenCalled();
    expect(transaction.aiUsageEvent.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { status: "FAILED" } });
  });

  it("estimates a bounded reservation for prompts without provider tokenizers", () => {
    expect(estimateReservedTokens("hello", 100)).toBe(1_902);
  });
});
