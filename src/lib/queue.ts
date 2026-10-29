import { Queue } from "bullmq";

function createConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required to queue workflow runs.");
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

let workflowQueue: Queue | undefined;
export function getWorkflowQueue() {
  workflowQueue ??= new Queue("workflow-runs", { connection: createConnection() });
  return workflowQueue;
}
