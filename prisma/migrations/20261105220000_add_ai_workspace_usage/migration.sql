CREATE TABLE "AiWorkspaceUsage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "requestsUsed" INTEGER NOT NULL DEFAULT 0,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiWorkspaceUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiWorkspaceUsage_organizationId_periodStart_key"
ON "AiWorkspaceUsage"("organizationId", "periodStart");
CREATE INDEX "AiWorkspaceUsage_periodStart_idx"
ON "AiWorkspaceUsage"("periodStart");

ALTER TABLE "AiWorkspaceUsage"
ADD CONSTRAINT "AiWorkspaceUsage_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiUsageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "reservedTokens" INTEGER NOT NULL,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsageEvent_organizationId_createdAt_idx"
ON "AiUsageEvent"("organizationId", "createdAt");
CREATE INDEX "AiUsageEvent_status_createdAt_idx"
ON "AiUsageEvent"("status", "createdAt");

ALTER TABLE "AiUsageEvent"
ADD CONSTRAINT "AiUsageEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
