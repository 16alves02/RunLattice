import { Worker, type Job } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required to start the worker.");
const parsedUrl = new URL(redisUrl);
const connection = { host: parsedUrl.hostname, port: Number(parsedUrl.port || 6379), username: parsedUrl.username || undefined, password: parsedUrl.password || undefined, maxRetriesPerRequest: null, ...(parsedUrl.protocol === "rediss:" ? { tls: {} } : {}) };

interface WorkflowJob { runId: string; workflowId: string }

const worker = new Worker<WorkflowJob>("workflow-runs", async (job: Job<WorkflowJob>) => {
  const { runId, workflowId } = job.data;
  const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!run || !workflow) throw new Error("Workflow run or workflow no longer exists.");
  if (workflow.status !== "ACTIVE") {
    await prisma.workflowRun.update({ where: { id: runId }, data: { status: "CANCELLED", error: "Workflow was paused before execution.", finishedAt: new Date() } });
    return { skipped: true };
  }

  await prisma.workflowRun.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date(), error: null } });
  try {
    const definition = workflow.definition as { nodes?: Array<{ id: string; kind: string; title: string; detail?: string }> };
    const steps = definition.nodes ?? [];
    // This first worker version validates and records the path; action execution is deliberately not arbitrary code.
    const completedSteps = steps.map((step) => ({ id: step.id, type: step.kind, title: step.title, result: "simulated" }));
    const output = { workflowId, runId, completedSteps, message: "Execution recorded. Connect supported action adapters to perform external side effects." };
    await prisma.workflowRun.update({ where: { id: runId }, data: { status: "SUCCEEDED", output, finishedAt: new Date() } });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected execution error.";
    await prisma.workflowRun.update({ where: { id: runId }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    throw error;
  }
}, { connection, concurrency: 5 });

worker.on("completed", (job) => console.info(`[worker] run ${job.id} completed`));
worker.on("failed", (job, error) => console.error(`[worker] run ${job?.id ?? "unknown"} failed: ${error.message}`));
worker.on("error", (error) => console.error(`[worker] worker error: ${error.message}`));

async function shutdown(signal: string) {
  console.info(`[worker] ${signal} received; closing gracefully`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
