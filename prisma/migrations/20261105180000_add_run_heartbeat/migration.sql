ALTER TABLE "WorkflowRun" ADD COLUMN "heartbeatAt" TIMESTAMP(3);

UPDATE "WorkflowRun"
SET "heartbeatAt" = "startedAt"
WHERE "status" = 'RUNNING' AND "heartbeatAt" IS NULL;
