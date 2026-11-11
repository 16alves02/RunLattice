-- Keep the TwoFactor table inaccessible through Supabase Data API roles.
-- The application connects through the dedicated Prisma role (BYPASSRLS).
REVOKE ALL PRIVILEGES ON TABLE public."TwoFactor" FROM anon, authenticated;
ALTER TABLE public."TwoFactor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_api_roles" ON public."TwoFactor";
CREATE POLICY "deny_all_api_roles"
  ON public."TwoFactor"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
