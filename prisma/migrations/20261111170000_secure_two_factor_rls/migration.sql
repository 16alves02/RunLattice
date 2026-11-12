ALTER TABLE public."TwoFactor" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  api_role text;
  policy_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      policy_name := 'deny_all_api_roles_' || api_role;
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public."TwoFactor" FROM %I', api_role);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."TwoFactor"', policy_name);
      EXECUTE format(
        'CREATE POLICY %I ON public."TwoFactor" FOR ALL TO %I USING (false) WITH CHECK (false)',
        policy_name, api_role
      );
    END IF;
  END LOOP;

  -- Replace the original combined policy only after the per-role policies
  -- are in place, avoiding a temporary gap in protection.
  DROP POLICY IF EXISTS "deny_all_api_roles" ON public."TwoFactor";
END
$$;
