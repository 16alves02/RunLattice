-- Defence in depth for Better Auth + Prisma.
-- Trusted application services access PostgreSQL server-side only.
-- Supabase Data API roles must not access application tables directly.
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
END
$$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
