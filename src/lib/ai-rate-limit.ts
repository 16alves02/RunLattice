import { createHash, randomUUID } from "node:crypto";

type RateLimitDatabase = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

const WINDOW_MS = 60_000;
const DEFAULT_USER_LIMIT = 5;
const DEFAULT_WORKSPACE_LIMIT = 30;

function readLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function opaqueKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function incrementWindow(database: RateLimitDatabase, key: string, now: number) {
  const rows = await database.$queryRawUnsafe<Array<{ count: number }>>(
    `INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
     VALUES ($1, $2, 1, $3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE
         WHEN "RateLimit"."lastRequest" <= $4 THEN 1
         ELSE "RateLimit"."count" + 1
       END,
       "lastRequest" = CASE
         WHEN "RateLimit"."lastRequest" <= $4 THEN $3
         ELSE "RateLimit"."lastRequest"
       END
     RETURNING "count"`,
    randomUUID(),
    key,
    BigInt(now),
    BigInt(now - WINDOW_MS),
  );
  return rows[0]?.count ?? 0;
}

/**
 * Atomic fixed-window limits backed by the existing PostgreSQL RateLimit
 * table. Keys are hashed so raw workspace/user identifiers are not stored.
 */
export async function consumeAIRequestRateLimit(
  database: RateLimitDatabase,
  input: { organizationId: string; userId: string; now?: number },
) {
  const now = input.now ?? Date.now();
  const userLimit = readLimit(process.env.AI_RATE_LIMIT_PER_USER, DEFAULT_USER_LIMIT);
  const workspaceLimit = readLimit(process.env.AI_RATE_LIMIT_PER_WORKSPACE, DEFAULT_WORKSPACE_LIMIT);
  const userKey = `runlattice:ai:user:${opaqueKey(input.organizationId + ":" + input.userId)}`;
  const workspaceKey = `runlattice:ai:workspace:${opaqueKey(input.organizationId)}`;

  const userCount = await incrementWindow(database, userKey, now);
  if (userCount > userLimit) {
    return { allowed: false as const, scope: "user" as const, limit: userLimit };
  }

  const workspaceCount = await incrementWindow(database, workspaceKey, now);
  if (workspaceCount > workspaceLimit) {
    return { allowed: false as const, scope: "workspace" as const, limit: workspaceLimit };
  }

  return { allowed: true as const };
}
