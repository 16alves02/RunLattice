import type { PrismaClient } from "@prisma/client";

interface CreateRunStepInput {
  runId: string;
  leaseToken: string;
  nodeId: string;
  title: string;
  kind: string;
}

/**
 * Creates a RUNNING ledger step only while holding a lock on the run row.
 * Stale-run recovery updates that same row before reconciling its steps, so
 * recovery and step creation cannot pass each other and leave an orphan step.
 */
export async function createRunStepIfLeaseOwned(
  database: PrismaClient,
  input: CreateRunStepInput,
) {
  return database.$transaction(async (transaction) => {
    const leaseRows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "WorkflowRun"
      WHERE "id" = ${input.runId}
        AND "status" = 'RUNNING'
        AND "leaseToken" = ${input.leaseToken}
      FOR UPDATE
    `;
    if (leaseRows.length === 0) return null;

    return transaction.workflowRunStep.create({
      data: {
        runId: input.runId,
        nodeId: input.nodeId,
        title: input.title,
        kind: input.kind,
        status: "RUNNING",
      },
    });
  });
}
