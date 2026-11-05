CREATE TABLE "AIWorkspaceUsage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "requestsUsed" INTEGER NOT NULL DEFAULT 0,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIWorkspaceUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIWorkspaceUsage_organizationId_periodStart_key"
ON "AIWorkspaceUsage"("organizationId", "periodStart");
CREATE INDEX "AIWorkspaceUsage_periodStart_idx"
ON "AIWorkspaceUsage"("periodStart");

ALTER TABLE "AIWorkspaceUsage"
ADD CONSTRAINT "AIWorkspaceUsage_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AIUsageEvent" (
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
  CONSTRAINT "AIUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageEvent_organizationId_createdAt_idx"
ON "AIUsageEvent"("organizationId", "createdAt");
CREATE INDEX "AIUsageEvent_status_createdAt_idx"
ON "AIUsageEvent"("status", "createdAt");

ALTER TABLE "AIUsageEvent"
ADD CONSTRAINT "AIUsageEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
