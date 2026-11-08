CREATE TABLE "AIProviderCredential" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "secretCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIProviderCredential_organizationId_provider_key"
  ON "AIProviderCredential"("organizationId", "provider");
CREATE INDEX "AIProviderCredential_organizationId_updatedAt_idx"
  ON "AIProviderCredential"("organizationId", "updatedAt");

ALTER TABLE "AIProviderCredential"
  ADD CONSTRAINT "AIProviderCredential_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIProviderCredential" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "AiUsageEvent"
  ADD COLUMN "billingSource" TEXT NOT NULL DEFAULT 'platform';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "AIProviderCredential" FROM anon, authenticated;
    CREATE POLICY deny_supabase_data_api_roles ON "AIProviderCredential"
      FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END
$$;
