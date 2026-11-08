ALTER TABLE "StripeEvent"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "objectId" TEXT,
  ADD COLUMN "actionRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StripeEvent"
  ADD CONSTRAINT "StripeEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StripeEvent_organizationId_actionRequired_createdAt_idx"
  ON "StripeEvent"("organizationId", "actionRequired", "createdAt");
