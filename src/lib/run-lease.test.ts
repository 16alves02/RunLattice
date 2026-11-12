import { describe, expect, it, vi } from "vitest";
import { createRunStepIfLeaseOwned } from "@/lib/run-lease";

describe("lease-fenced workflow step creation", () => {
  const input = {
    runId: "run-1",
    leaseToken: "lease-1",
    nodeId: "action-1",
    title: "Send notification",
    kind: "action",
  };

  it("locks and validates the run before creating its ledger step", async () => {
    const step = { id: "step-1", ...input, status: "RUNNING" };
    const queryRaw = vi.fn().mockResolvedValue([{ id: input.runId }]);
    const create = vi.fn().mockResolvedValue(step);
    const transaction = {
      $queryRaw: queryRaw,
      workflowRunStep: { create },
    };
    const database = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };

    await expect(createRunStepIfLeaseOwned(database as never, input)).resolves.toEqual(step);

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: {
        runId: input.runId,
        nodeId: input.nodeId,
        title: input.title,
        kind: input.kind,
        status: "RUNNING",
      },
    });
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  });

  it("does not create a step after recovery has invalidated the lease", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const create = vi.fn();
    const transaction = {
      $queryRaw: queryRaw,
      workflowRunStep: { create },
    };
    const database = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };

    await expect(createRunStepIfLeaseOwned(database as never, input)).resolves.toBeNull();

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });
});
