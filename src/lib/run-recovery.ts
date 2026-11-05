import type { PrismaClient } from "@prisma/client";

type RunRecoveryDatabase = Pick<PrismaClient, "workflowRun">;

export const STALE_RUN_HEARTBEAT_TIMEOUT_MS = 5 * 60_000;

export const STALE_RUN_ERROR =
  "Execution was interrupted after its worker heartbeat expired. The outcome of an external action may be unknown; the run was not retried automatically.";

/**
 * Marks abandoned runs as failed without replaying external actions.
 * A stale heartbeat means the worker stopped reporting progress, not that
 * the last external side effect definitely failed.
 */
export async function recoverStaleWorkflowRuns(
  database: RunRecoveryDatabase,
  now = new Date(),
): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_RUN_HEARTBEAT_TIMEOUT_MS);
  const result = await database.workflowRun.updateMany({
    where: {
      status: "RUNNING",
      heartbeatAt: { lt: staleBefore },
    },
    data: {
      status: "FAILED",
      error: STALE_RUN_ERROR,
      finishedAt: now,
      heartbeatAt: null,
    },
  });

  return result.count;
}
