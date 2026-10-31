-- Initial RunLattice workflow persistence schema.
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'WEBHOOK', 'SCHEDULE');

CREATE TABLE "Workflow" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "triggerType" "TriggerType" NOT NULL DEFAULT 'MANUAL',
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Workflow_status_updatedAt_idx" ON "Workflow"("status", "updatedAt");

CREATE TABLE "WorkflowRun" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowRun_workflowId_createdAt_idx" ON "WorkflowRun"("workflowId", "createdAt");
CREATE INDEX "WorkflowRun_status_createdAt_idx" ON "WorkflowRun"("status", "createdAt");
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
