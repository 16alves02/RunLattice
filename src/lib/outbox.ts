import type { PrismaClient } from "@prisma/client";

type OutboxDatabase = Pick<PrismaClient, "workflowRunOutbox">;

type WorkflowQueue = {
  add(
    name: string,
    data: { runId: string; workflowId: string },
    options: { jobId: string; attempts: number; removeOnComplete: number; removeOnFail: number },
  ): Promise<unknown>;
};

/**
 * Delivers committed run intents to BullMQ. A deterministic job ID makes a
 * repeated dispatch harmless while the corresponding BullMQ job is retained.
 */
export async function dispatchPendingWorkflowRuns(
  database: OutboxDatabase,
  queue: WorkflowQueue,
  now = new Date(),
): Promise<number> {
  const pending = await database.workflowRunOutbox.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true, runId: true, run: { select: { workflowId: true } } },
  });

  let dispatched = 0;
  for (const event of pending) {
    try {
      await queue.add(
        "execute-workflow",
        { runId: event.runId, workflowId: event.run.workflowId },
        { jobId: event.runId, attempts: 1, removeOnComplete: 500, removeOnFail: 1000 },
      );
      await database.workflowRunOutbox.updateMany({
        where: { id: event.id, dispatchedAt: null },
        data: { dispatchedAt: now, attempts: { increment: 1 }, lastError: null },
      });
      dispatched += 1;
    } catch (error) {
      await database.workflowRunOutbox.updateMany({
        where: { id: event.id, dispatchedAt: null },
        data: {
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Queue dispatch failed.",
        },
      });
    }
  }

  return dispatched;
}
