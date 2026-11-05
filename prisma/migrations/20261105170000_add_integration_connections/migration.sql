CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "credentialsCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationConnection_organizationId_provider_createdAt_idx"
  ON "IntegrationConnection"("organizationId", "provider", "createdAt");

ALTER TABLE "IntegrationConnection"
  ADD CONSTRAINT "IntegrationConnection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
