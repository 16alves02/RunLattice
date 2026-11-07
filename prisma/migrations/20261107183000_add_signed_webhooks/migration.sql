ALTER TABLE "Workflow"
  ADD COLUMN "webhookSecretCiphertext" TEXT,
  ADD COLUMN "webhookEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookDelivery_workflowId_eventId_key"
  ON "WebhookDelivery"("workflowId", "eventId");
CREATE INDEX "WebhookDelivery_createdAt_idx"
  ON "WebhookDelivery"("createdAt");
ALTER TABLE "WebhookDelivery"
  ADD CONSTRAINT "WebhookDelivery_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
