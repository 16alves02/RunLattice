CREATE TABLE "WorkflowRunStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  CONSTRAINT "WorkflowRunStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowRunStep_runId_nodeId_attempt_key"
ON "WorkflowRunStep"("runId", "nodeId", "attempt");
CREATE INDEX "WorkflowRunStep_runId_status_idx"
ON "WorkflowRunStep"("runId", "status");

ALTER TABLE "WorkflowRunStep"
ADD CONSTRAINT "WorkflowRunStep_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
