-- Defence in depth for Better Auth + Prisma.
-- Trusted application services access PostgreSQL server-side only.
-- Supabase Data API roles are explicitly denied access to application tables.
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', item.schemaname, item.tablename);
  END LOOP;

  -- Supabase defines these roles; plain PostgreSQL CI databases may not.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;

  -- Add explicit deny policies only when both Supabase Data API roles exist.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOR item IN
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = item.schemaname
          AND tablename = item.tablename
          AND policyname = 'deny_supabase_data_api_roles'
      ) THEN
        EXECUTE format(
          'CREATE POLICY deny_supabase_data_api_roles ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
          item.schemaname, item.tablename
        );
      END IF;
    END LOOP;
  END IF;
END
$$;
