import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const pendingMigration = "20261107235000_add_workspace_billing";

try {
  const [tableState] = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (tableState.count < 16) {
    throw new Error(`Refusing to baseline an unexpected database: expected at least 16 existing application tables, found ${tableState.count}.`);
  }

  const [migrationTable] = await prisma.$queryRaw`
    SELECT to_regclass('public."_prisma_migrations"')::text AS table_name
  `;
  const appliedRows = migrationTable.table_name
    ? await prisma.$queryRaw`SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL`
    : [];
  const applied = new Set(appliedRows.map((row) => row.migration_name));

  const migrationsPath = resolve(process.cwd(), "prisma/migrations");
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  // Only migrations that predate the first post-baseline billing migration
  // belong to the existing Supabase schema. Newer migrations must run normally.
  const priorMigrations = migrations.filter((name) => name < pendingMigration);

  if (priorMigrations.length !== 12) {
    throw new Error(`Refusing to baseline: expected 12 previously applied migrations, found ${priorMigrations.length}.`);
  }

  const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
  for (const migration of priorMigrations) {
    if (applied.has(migration)) continue;
    console.info(`[db:baseline] Marking existing migration as applied: ${migration}`);
    execFileSync(process.execPath, [prismaCli, "migrate", "resolve", "--applied", migration], { stdio: "inherit" });
  }


  // Prisma creates its own metadata table before applying migrations. Keep it
  // private too; the dedicated Prisma role bypasses RLS for migrations.
  await prisma.$executeRaw`ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY`;
  const [apiRoles] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS present
  `;
  if (apiRoles.present) {
    await prisma.$executeRaw`REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM anon, authenticated`;
    const [policyState] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = '_prisma_migrations'
          AND policyname = 'deny_supabase_data_api_roles'
      ) AS present
    `;
    if (!policyState.present) {
      await prisma.$executeRaw`CREATE POLICY deny_supabase_data_api_roles ON public."_prisma_migrations" FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)`;
    }
  }

  const [billingState] = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('BillingCustomer', 'BillingSubscription', 'StripeEvent')
  `;
  if (billingState.count === 3 && !applied.has(pendingMigration)) {
    console.info("[db:baseline] Billing tables already exist; marking their migration as applied.");
    execFileSync(process.execPath, [prismaCli, "migrate", "resolve", "--applied", pendingMigration], { stdio: "inherit" });
  }

  console.info("[db:baseline] Existing schema and Prisma migration history are synchronized.");
} finally {
  await prisma.$disconnect();
}
