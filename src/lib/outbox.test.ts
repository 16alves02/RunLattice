import { describe, expect, it, vi } from "vitest";
import { dispatchPendingWorkflowRuns } from "@/lib/outbox";

describe("workflow run outbox", () => {
  it("dispatches pending runs with deterministic job IDs and marks them delivered", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi.fn().mockResolvedValue([
      { id: "event-1", runId: "run-1", run: { workflowId: "workflow-1" } },
    ]);
    const add = vi.fn().mockResolvedValue({});
    const database = { workflowRunOutbox: { findMany, updateMany } };
    const now = new Date("2026-11-05T17:00:00.000Z");

    const count = await dispatchPendingWorkflowRuns(database as never, { add }, now);

    expect(count).toBe(1);
    expect(add).toHaveBeenCalledWith("execute-workflow", {
      runId: "run-1",
      workflowId: "workflow-1",
    }, {
      jobId: "run-1",
      attempts: 1,
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "event-1", dispatchedAt: null },
      data: { dispatchedAt: now, attempts: { increment: 1 }, lastError: null },
    });
  });

  it("records a bounded error and leaves failed events pending for another dispatch", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi.fn().mockResolvedValue([
      { id: "event-2", runId: "run-2", run: { workflowId: "workflow-2" } },
    ]);
    const add = vi.fn().mockRejectedValue(new Error("Redis unavailable"));
    const database = { workflowRunOutbox: { findMany, updateMany } };

    const count = await dispatchPendingWorkflowRuns(database as never, { add });

    expect(count).toBe(0);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "event-2", dispatchedAt: null },
      data: { attempts: { increment: 1 }, lastError: "Redis unavailable" },
    });
  });
});
