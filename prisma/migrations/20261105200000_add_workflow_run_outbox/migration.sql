CREATE TABLE "WorkflowRunOutbox" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "dispatchedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRunOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowRunOutbox_runId_key" ON "WorkflowRunOutbox"("runId");
CREATE INDEX "WorkflowRunOutbox_dispatchedAt_createdAt_idx" ON "WorkflowRunOutbox"("dispatchedAt", "createdAt");

ALTER TABLE "WorkflowRunOutbox"
ADD CONSTRAINT "WorkflowRunOutbox_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
