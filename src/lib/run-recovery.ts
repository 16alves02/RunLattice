import type { PrismaClient } from "@prisma/client";

type RunRecoveryDatabase = Pick<PrismaClient, "workflowRun" | "workflowRunStep">;

export const STALE_RUN_HEARTBEAT_TIMEOUT_MS = 5 * 60_000;

export const STALE_RUN_ERROR =
  "Execution was interrupted after its worker heartbeat expired. The outcome of an external action may be unknown; the run was not retried automatically.";

/**
 * Marks abandoned runs as failed without replaying external actions. Any action
 * step left running is marked outcome-unknown rather than assumed to have failed.
 */
export async function recoverStaleWorkflowRuns(
  database: RunRecoveryDatabase,
  now = new Date(),
): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_RUN_HEARTBEAT_TIMEOUT_MS);
  const candidates = await database.workflowRun.findMany({
    where: { status: "RUNNING", heartbeatAt: { lt: staleBefore } },
    select: { id: true },
  });
  if (candidates.length === 0) return 0;

  const result = await database.workflowRun.updateMany({
    where: {
      id: { in: candidates.map((run) => run.id) },
      status: "RUNNING",
      heartbeatAt: { lt: staleBefore },
    },
    data: {
      status: "FAILED",
      error: STALE_RUN_ERROR,
      finishedAt: now,
      heartbeatAt: null,
      leaseToken: null,
    },
  });

  if (result.count > 0) {
    const recovered = await database.workflowRun.findMany({
      where: {
        id: { in: candidates.map((run) => run.id) },
        status: "FAILED",
        finishedAt: now,
      },
      select: { id: true },
    });
    const runIds = recovered.map((run) => run.id);
    if (runIds.length > 0) {
      await database.workflowRunStep.updateMany({
        where: { runId: { in: runIds }, status: "RUNNING", kind: "action" },
        data: {
          status: "OUTCOME_UNKNOWN",
          finishedAt: now,
          error: "The worker stopped during an external action; delivery may have occurred.",
        },
      });
      await database.workflowRunStep.updateMany({
        where: { runId: { in: runIds }, status: "RUNNING", kind: { not: "action" } },
        data: { status: "FAILED", finishedAt: now, error: "The worker stopped before this step completed." },
      });
    }
  }

  return result.count;
}
