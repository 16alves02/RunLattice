CREATE TABLE "SlackOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlackOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlackOAuthState_stateHash_key" ON "SlackOAuthState"("stateHash");
CREATE INDEX "SlackOAuthState_expiresAt_idx" ON "SlackOAuthState"("expiresAt");
CREATE INDEX "SlackOAuthState_organizationId_createdAt_idx" ON "SlackOAuthState"("organizationId", "createdAt");

ALTER TABLE "SlackOAuthState" ADD CONSTRAINT "SlackOAuthState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlackOAuthState" ADD CONSTRAINT "SlackOAuthState_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."SlackOAuthState" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  api_role text;
  policy_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      policy_name := 'deny_slack_oauth_state_' || api_role;
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."SlackOAuthState" FROM %I', api_role);
      EXECUTE format(
        'CREATE POLICY %I ON public."SlackOAuthState" FOR ALL TO %I USING (false) WITH CHECK (false)',
        policy_name, api_role
      );
    END IF;
  END LOOP;
END
$$;
