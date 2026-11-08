import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionRunner } = vi.hoisted(() => ({
  transactionRunner: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transactionRunner },
}));

import { createQuotaBoundWorkflowRun } from "@/lib/run-quota";

function createTransaction(used: number) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    billingSubscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    workflowRun: {
      count: vi.fn().mockResolvedValue(used),
    },
  };
  return transaction;
}

describe("workspace monthly execution quota", () => {
  beforeEach(() => transactionRunner.mockReset());

  it("admits the final available Free execution under a workspace lock", async () => {
    const transaction = createTransaction(99);
    transactionRunner.mockImplementation(async (...args: unknown[]) => {
      const callback = args.find(
        (argument): argument is (tx: typeof transaction) => Promise<unknown> =>
          typeof argument === "function",
      );
      if (!callback) {
        throw new Error("Expected Prisma $transaction to receive a callback.");
      }
      return callback(transaction);
    });

    const create = vi.fn().mockResolvedValue({ id: "run-100" });
    const result = await createQuotaBoundWorkflowRun({
      organizationId: "workspace-1",
      create,
      now: new Date("2026-11-08T12:00:00.000Z"),
    });

    expect(result).toEqual({ allowed: true, data: { id: "run-100" }, used: 100, limit: 100 });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.workflowRun.count.mock.invocationCallOrder[0],
    );
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects an execution once the Free monthly limit is reached", async () => {
    const transaction = createTransaction(100);
    transactionRunner.mockImplementation((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));

    const create = vi.fn().mockResolvedValue({ id: "must-not-be-created" });
    const result = await createQuotaBoundWorkflowRun({
      organizationId: "workspace-1",
      create,
      now: new Date("2026-11-08T12:00:00.000Z"),
    });

    expect(result).toEqual({ allowed: false, used: 100, limit: 100 });
    expect(create).not.toHaveBeenCalled();
  });
});
