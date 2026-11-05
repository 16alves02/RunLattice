import { describe, expect, it, vi } from "vitest";
import {
  recoverStaleWorkflowRuns,
  STALE_RUN_ERROR,
  STALE_RUN_HEARTBEAT_TIMEOUT_MS,
} from "@/lib/run-recovery";

describe("stale workflow run recovery", () => {
  it("marks only RUNNING runs with expired heartbeats as failed", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const database = { workflowRun: { updateMany } };
    const now = new Date("2026-11-05T16:00:00.000Z");

    const count = await recoverStaleWorkflowRuns(database as never, now);

    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
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
  });

  it("does not replay interrupted runs", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const database = { workflowRun: { updateMany } };

    await recoverStaleWorkflowRuns(database as never);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0]).not.toHaveProperty("data.attempts");
    expect(updateMany.mock.calls[0][0].data.status).toBe("FAILED");
  });
});
