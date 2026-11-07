import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const pendingMigration = "20261107235000_add_workspace_billing";

try {
  const [migrationState] = await prisma.$queryRaw\`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS migration_table_exists\`;
  if (migrationState.migration_table_exists) {
    console.info("[db:baseline] Prisma migration history already exists; skipping baseline.");
  } else {
    const [tableState] = await prisma.$queryRaw\`
      SELECT count(*)::int AS count
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    \`;
    if (tableState.count !== 16) {
      throw new Error(\`Refusing to baseline an unexpected database: expected 16 existing application tables, found \${tableState.count}.\`);
    }

    const migrationsPath = resolve(process.cwd(), "prisma/migrations");
    const entries = await readdir(migrationsPath, { withFileTypes: true });
    const migrations = entries
      .filter((entry) => entry.isDirectory() && /^\\d{14}_/.test(entry.name))
      .map((entry) => entry.name)
      .filter((name) => name !== pendingMigration)
      .sort();

    if (migrations.length !== 12) {
      throw new Error(\`Refusing to baseline: expected 12 previously applied migrations, found \${migrations.length}.\`);
    }

    const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
    for (const migration of migrations) {
      console.info(\`[db:baseline] Marking existing migration as applied: \${migration}\`);
      execFileSync(process.execPath, [prismaCli, "migrate", "resolve", "--applied", migration], { stdio: "inherit" });
    }
    console.info("[db:baseline] Existing database schema has been baselined.");
  }
} finally {
  await prisma.$disconnect();
}
