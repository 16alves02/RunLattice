import { describe, expect, it, vi } from "vitest";
import {
  recoverStaleWorkflowRuns,
  STALE_RUN_ERROR,
  STALE_RUN_HEARTBEAT_TIMEOUT_MS,
} from "@/lib/run-recovery";

describe("stale workflow run recovery", () => {
  it("marks only RUNNING runs with expired heartbeats as failed", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const findMany = vi.fn().mockResolvedValue([{ id: "run-1" }, { id: "run-2" }]);
    const stepUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = { workflowRun: { findMany, updateMany }, workflowRunStep: { updateMany: stepUpdateMany } };
    const now = new Date("2026-11-05T16:00:00.000Z");

    const count = await recoverStaleWorkflowRuns(database as never, now);

    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["run-1", "run-2"] },
        status: "RUNNING",
        heartbeatAt: { lt: new Date(now.getTime() - STALE_RUN_HEARTBEAT_TIMEOUT_MS) },
      },
      data: {
        status: "FAILED",
        error: STALE_RUN_ERROR,
        finishedAt: now,
        heartbeatAt: null,
        leaseToken: null,
      },
    });
    expect(stepUpdateMany).toHaveBeenCalledTimes(2);
    expect(stepUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { runId: { in: ["run-1", "run-2"] }, status: "RUNNING", kind: "action" },
      data: {
        status: "OUTCOME_UNKNOWN",
        finishedAt: now,
        error: "The worker stopped during an external action; delivery may have occurred.",
      },
    });
    expect(stepUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { runId: { in: ["run-1", "run-2"] }, status: "RUNNING", kind: { not: "action" } },
      data: {
        status: "FAILED",
        finishedAt: now,
        error: "The worker stopped before this step completed.",
      },
    });
  });

  it("does not query or update steps when no stale run is found", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const updateMany = vi.fn();
    const stepUpdateMany = vi.fn();
    const database = {
      workflowRun: { findMany, updateMany },
      workflowRunStep: { updateMany: stepUpdateMany },
    };

    await expect(recoverStaleWorkflowRuns(database as never)).resolves.toBe(0);

    expect(updateMany).not.toHaveBeenCalled();
    expect(stepUpdateMany).not.toHaveBeenCalled();
  });

  it("does not update steps when another worker has already claimed the stale runs", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "run-1" }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const stepUpdateMany = vi.fn();
    const database = {
      workflowRun: { findMany, updateMany },
      workflowRunStep: { updateMany: stepUpdateMany },
    };

    await expect(recoverStaleWorkflowRuns(database as never)).resolves.toBe(0);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(stepUpdateMany).not.toHaveBeenCalled();
  });

  it("does not replay interrupted runs", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findMany = vi.fn().mockResolvedValue([{ id: "run-1" }]);
    const database = { workflowRun: { findMany, updateMany }, workflowRunStep: { updateMany: vi.fn() } };

    await recoverStaleWorkflowRuns(database as never);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0]).not.toHaveProperty("data.attempts");
    expect(updateMany.mock.calls[0][0].data.status).toBe("FAILED");
  });
});
