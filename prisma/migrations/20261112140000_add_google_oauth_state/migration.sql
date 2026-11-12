CREATE TABLE "GoogleOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "codeVerifierCiphertext" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleOAuthState_stateHash_key" ON "GoogleOAuthState"("stateHash");
CREATE INDEX "GoogleOAuthState_expiresAt_idx" ON "GoogleOAuthState"("expiresAt");
CREATE INDEX "GoogleOAuthState_organizationId_createdAt_idx" ON "GoogleOAuthState"("organizationId", "createdAt");

ALTER TABLE "GoogleOAuthState" ADD CONSTRAINT "GoogleOAuthState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleOAuthState" ADD CONSTRAINT "GoogleOAuthState_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OAuth state and PKCE verifier are sensitive application-only records.
ALTER TABLE public."GoogleOAuthState" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  api_role text;
  policy_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      policy_name := 'deny_google_oauth_state_' || api_role;
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."GoogleOAuthState" FROM %I', api_role);
      EXECUTE format(
        'CREATE POLICY %I ON public."GoogleOAuthState" FOR ALL TO %I USING (false) WITH CHECK (false)',
        policy_name, api_role
      );
    END IF;
  END LOOP;
END
$$;
