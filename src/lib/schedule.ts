import { Queue } from "bullmq";
import type { WorkflowDefinition } from "./types";
import { getTriggerConfig } from "./trigger-type";

function redisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for scheduled workflow triggers.");
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

let scheduleQueue: Queue | undefined;

export function getScheduleQueue() {
  scheduleQueue ??= new Queue("workflow-schedules", { connection: redisConnection() });
  return scheduleQueue;
}

export async function syncWorkflowSchedule(input: {
  workflowId: string;
  status: string;
  triggerType: string;
  definition: WorkflowDefinition;
}) {
  const queue = getScheduleQueue();
  const schedulerId = `workflow:${input.workflowId}`;
  const config = getTriggerConfig(input.definition);

  if (input.status !== "ACTIVE" || input.triggerType !== "SCHEDULE" || config.triggerType !== "SCHEDULE" || !config.cronExpression) {
    return await queue.removeJobScheduler(schedulerId);
  }

  await queue.upsertJobScheduler(
    schedulerId,
    { pattern: config.cronExpression, tz: config.timezone || "UTC" },
    {
      name: "scheduled-trigger",
      data: { workflowId: input.workflowId },
      opts: { removeOnComplete: 100, removeOnFail: 500 },
    },
  );
}
