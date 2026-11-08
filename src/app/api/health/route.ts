import { Queue } from "bullmq";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redisConnection() {
  const value = process.env.REDIS_URL;
  if (!value) throw new Error("REDIS_URL is not configured.");
  const url = new URL(value);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://.");
  }
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export async function GET() {
  const checks = { database: "error", redis: "error", worker: "error" };
  let queue: Queue | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    // Keep the public health response free of connection details.
  }

  try {
    queue = new Queue("runlattice-health-check", { connection: redisConnection() });
    const client = await queue.client as unknown as {
      ping: () => Promise<string>;
      get: (key: string) => Promise<string | null>;
    };
    await client.ping();
    checks.redis = "ok";
    const heartbeat = await client.get("runlattice:worker:heartbeat");
    const heartbeatAt = heartbeat ? Number(heartbeat) : 0;
    if (Number.isFinite(heartbeatAt) && heartbeatAt > 0 && Date.now() - heartbeatAt < 90_000) {
      checks.worker = "ok";
    }
  } catch {
    // Keep the public health response free of connection details.
  } finally {
    await queue?.close().catch(() => undefined);
  }

  const healthy = checks.database === "ok" && checks.redis === "ok" && checks.worker === "ok";
  return NextResponse.json({
    status: healthy ? "ok" : "degraded",
    service: "runlattice-web",
    checks,
    timestamp: new Date().toISOString(),
  }, { status: healthy ? 200 : 503 });
}
