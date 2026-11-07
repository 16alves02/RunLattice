import { Queue, Worker, type Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { decryptSecret } from "../src/lib/secrets";
import { recoverStaleWorkflowRuns } from "../src/lib/run-recovery";
import { dispatchPendingWorkflowRuns } from "../src/lib/outbox";
import { renderInputTemplate } from "../src/lib/template";
import { resolveExecutionPath, validateExecutableWorkflow } from "../src/lib/execution";
import { evaluateCondition } from "../src/lib/condition";
import { workflowDefinitionSchema, createIntegrationConnectionSchema } from "../src/lib/validation";
import type { DiscordActionConfig, WorkflowDefinition } from "../src/lib/types";
import { getScheduleQueue, syncWorkflowSchedule } from "../src/lib/schedule";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required to start the worker.");

const parsedUrl = new URL(redisUrl);
const connection = {
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || 6379),
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
  maxRetriesPerRequest: null,
  ...(parsedUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

interface WorkflowJob {
  runId: string;
  workflowId: string;
}

interface ExecutionStep {
  nodeId: string;
  title: string;
  status: "SUCCEEDED" | "FAILED";
  startedAt: string;
  finishedAt: string;
  result?: { httpStatus?: number; condition?: boolean };
  error?: string;
}

function serializeSteps(steps: ExecutionStep[]): Prisma.InputJsonArray {
  return steps.map((step): Prisma.InputJsonObject => ({
    nodeId: step.nodeId,
    title: step.title,
    status: step.status,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    ...(step.result ? { result: { httpStatus: step.result.httpStatus ?? null, condition: step.result.condition ?? null } } : {}),
    ...(step.error ? { error: step.error } : {}),
  }));
}

function getSafeWebhookUrl(ciphertext: string, connectionName: string, organizationId: string) {
  let credentials: unknown;
  try {
    credentials = JSON.parse(decryptSecret(ciphertext, `${organizationId}:discord`));
  } catch {
    throw new Error("The stored Discord connection could not be decrypted.");
  }

  const webhookUrl = credentials && typeof credentials === "object" && "webhookUrl" in credentials
    ? credentials.webhookUrl
    : null;
  const validated = createIntegrationConnectionSchema.safeParse({
    provider: "discord",
    name: connectionName,
    webhookUrl,
  });
  if (!validated.success) throw new Error("The stored Discord webhook URL is invalid.");

  return validated.data.webhookUrl;
}

async function executeDiscordAction(config: DiscordActionConfig, organizationId: string, input: unknown) {
  if (!config.connectionId || !config.message?.trim()) throw new Error("The Discord action is missing its connection or message.");

  const integrationConnection = await prisma.integrationConnection.findFirst({
    where: {
      id: config.connectionId,
      organizationId,
      provider: "discord",
    },
    select: { credentialsCiphertext: true, name: true },
  });
  if (!integrationConnection) throw new Error("The Discord connection is unavailable in this workspace.");

  const webhookUrl = getSafeWebhookUrl(integrationConnection.credentialsCiphertext, integrationConnection.name, organizationId);
  const message = renderInputTemplate(config.message, input);
  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Discord did not respond within the 10-second action timeout.");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Discord returned a redirect, which is blocked for security.");
  }
  if (!response.ok) {
    throw new Error(`Discord rejected the message with HTTP ${response.status}.`);
  }

  return { httpStatus: response.status };
}

async function executeAction(node: WorkflowDefinition["nodes"][number], organizationId: string, input: unknown) {
  if (!node.config || !("integrationId" in node.config) || !node.config.connectionId || !node.config.message?.trim()) throw new Error(`Action "${node.title}" has not been configured.`);
  if (node.config.integrationId === "discord" && node.config.actionId === "send_message") {
    return executeDiscordAction(node.config, organizationId, input);
  }
  throw new Error(`Action "${node.title}" is not supported by this worker version.`);
}

const dispatchQueue = new Queue<WorkflowJob>("workflow-runs", { connection });

const scheduleWorker = new Worker<{ workflowId: string }>("workflow-schedules", async (job) => {
  if (job.name !== "scheduled-trigger" || !job.data.workflowId) return { skipped: true };
  const workflow = await prisma.workflow.findFirst({
    where: { id: job.data.workflowId, status: "ACTIVE", triggerType: "SCHEDULE" },
    select: { id: true, definition: true },
  });
  if (!workflow) return { skipped: true, reason: "Scheduled workflow is no longer active." };

  const parsed = workflowDefinitionSchema.safeParse(workflow.definition);
  if (!parsed.success) {
    console.error("[scheduler] Skipped a workflow with an invalid saved definition.");
    return { skipped: true };
  }
  const trigger = parsed.data.nodes.find((node) => node.kind === "trigger");
  if (!trigger?.config || !("triggerType" in trigger.config) || trigger.config.triggerType !== "SCHEDULE") {
    return { skipped: true, reason: "Workflow no longer has a schedule trigger." };
  }

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      input: { triggerType: "SCHEDULE", scheduledAt: new Date().toISOString() },
      outboxEvent: { create: {} },
    },
    select: { id: true },
  });
  console.info(`[scheduler] queued scheduled run ${run.id}`);
  return { runId: run.id };
}, { connection, concurrency: 5 });

async function syncActiveSchedules() {
  const workflows = await prisma.workflow.findMany({
    where: { status: "ACTIVE", triggerType: "SCHEDULE" },
    select: { id: true, status: true, triggerType: true, definition: true },
  });
  for (const workflow of workflows) {
    try {
      await syncWorkflowSchedule({
        workflowId: workflow.id,
        status: workflow.status,
        triggerType: workflow.triggerType,
        definition: workflow.definition as unknown as WorkflowDefinition,
      });
    } catch (error) {
      console.error("[scheduler] Unable to synchronize a scheduled workflow:", error instanceof Error ? error.message : "Unknown error");
    }
  }
}

void syncActiveSchedules().catch((error: unknown) => {
  console.error("[scheduler] Initial schedule synchronization failed:", error instanceof Error ? error.message : "Unknown error");
});
const scheduleSyncTimer = setInterval(() => {
  void syncActiveSchedules().catch((error: unknown) => {
    console.error("[scheduler] Schedule synchronization failed:", error instanceof Error ? error.message : "Unknown error");
  });
}, 60_000);
scheduleSyncTimer.unref();


const worker = new Worker<WorkflowJob>("workflow-runs", async (job: Job<WorkflowJob>) => {
  const { runId, workflowId } = job.data;
  const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
  if (!run || run.workflowId !== workflowId) {
    console.error("[worker] A queued run references a missing or mismatched workflow.");
    return { skipped: true };
  }

  // A fresh lease token fences every later write from this worker attempt.
  const leaseToken = randomUUID();
  const claimed = await prisma.workflowRun.updateMany({
    where: { id: runId, workflowId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), heartbeatAt: new Date(), leaseToken, error: null },
  });
  if (claimed.count === 0) return { skipped: true, reason: "Run was already claimed or completed." };

  const heartbeatTimer = setInterval(() => {
    void prisma.workflowRun.updateMany({
      where: { id: runId, status: "RUNNING", leaseToken },
      data: { heartbeatAt: new Date() },
    }).catch((error: unknown) => {
      console.error("[worker] Unable to refresh run heartbeat:", error instanceof Error ? error.message : "Unknown error");
    });
  }, 20_000);
  heartbeatTimer.unref();

  const ownsLease = async () => {
    const current = await prisma.workflowRun.findFirst({
      where: { id: runId, status: "RUNNING", leaseToken },
      select: { id: true },
    });
    return Boolean(current);
  };

  try {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow || workflow.status !== "ACTIVE" || !workflow.organizationId) {
    await prisma.workflowRun.updateMany({
      where: { id: runId, status: "RUNNING", leaseToken },
      data: {
        status: "CANCELLED",
        error: "Workflow is unavailable, inactive or not assigned to a workspace.",
        finishedAt: new Date(),
        heartbeatAt: null,
        leaseToken: null,
      },
    });
    return { skipped: true };
  }

  const steps: ExecutionStep[] = [];
  try {
    const parsedDefinition = workflowDefinitionSchema.safeParse(workflow.definition);
    if (!parsedDefinition.success) throw new Error("The saved workflow definition is invalid.");

    const definition = parsedDefinition.data as WorkflowDefinition;
    validateExecutableWorkflow(definition);
    const path = resolveExecutionPath(definition, run.input);
    for (const node of path) {
      const startedAt = new Date().toISOString();
      if (!(await ownsLease())) throw new Error("Execution lease was lost; this worker stopped.");
      await job.updateProgress({ currentNode: node.id, completed: steps.length, total: path.length });
      const ledgerStep = await prisma.workflowRunStep.create({
        data: { runId, nodeId: node.id, title: node.title, kind: node.kind, status: "RUNNING" },
      });

      try {
        let result: ExecutionStep["result"];
        if (node.kind === "trigger") {
          result = {};
        } else if (node.kind === "condition") {
          if (!node.config || !("operator" in node.config)) throw new Error(`Condition "${node.title}" has no valid rule.`);
          result = { condition: evaluateCondition(node.config, run.input) };
        } else {
          if (!(await ownsLease())) throw new Error("Execution lease was lost before the external action.");
          result = await executeAction(node, workflow.organizationId, run.input);
        }

        await prisma.workflowRunStep.update({
          where: { id: ledgerStep.id, run: { is: { status: "RUNNING", leaseToken } } },
          data: { status: "SUCCEEDED", finishedAt: new Date(), result: result ?? {} },
        });
        steps.push({
          nodeId: node.id,
          title: node.title,
          status: "SUCCEEDED",
          startedAt,
          finishedAt: new Date().toISOString(),
          ...(result ? { result } : {}),
        });
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : "The workflow step failed.";
        await prisma.workflowRunStep.update({
          where: { id: ledgerStep.id, run: { is: { status: "RUNNING", leaseToken } } },
          data: {
            status: node.kind === "action" ? "OUTCOME_UNKNOWN" : "FAILED",
            finishedAt: new Date(),
            error: safeMessage,
          },
        });
        steps.push({
          nodeId: node.id,
          title: node.title,
          status: "FAILED",
          startedAt,
          finishedAt: new Date().toISOString(),
          error: safeMessage,
        });
        throw new Error(safeMessage);
      }

      await prisma.workflowRun.updateMany({
        where: { id: runId, status: "RUNNING", leaseToken },
        data: { output: { executionMode: "LIVE", steps: serializeSteps(steps) } },
      });
    }

    const output = {
      executionMode: "LIVE",
      steps: serializeSteps(steps),
      message: "Workflow actions completed successfully.",
    };
    await prisma.workflowRun.updateMany({
      where: { id: runId, status: "RUNNING", leaseToken },
      data: { status: "SUCCEEDED", output, error: null, finishedAt: new Date(), heartbeatAt: null, leaseToken: null },
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workflow execution failed.";
    const output = {
      executionMode: "LIVE",
      steps: serializeSteps(steps),
      message: "Workflow execution stopped after a failed step.",
    };
    await prisma.workflowRun.updateMany({
      where: { id: runId, status: "RUNNING", leaseToken },
      data: { status: "FAILED", output, error: message, finishedAt: new Date(), heartbeatAt: null, leaseToken: null },
    });
    console.error("[worker] Workflow execution failed:", message);
    return { success: false };
  }
  } finally {
    clearInterval(heartbeatTimer);
  }
}, { connection, concurrency: 5 });

worker.on("completed", (job) => console.info(`[worker] run ${job.id} processed`));
worker.on("failed", (job, error) => console.error(`[worker] queue job ${job?.id ?? "unknown"} failed: ${error.message}`));
worker.on("error", (error) => console.error(`[worker] worker error: ${error.message}`));

async function dispatchOutbox() {
  try {
    const count = await dispatchPendingWorkflowRuns(prisma, dispatchQueue);
    if (count > 0) console.info(`[worker] dispatched ${count} workflow run(s) from outbox`);
  } catch (error) {
    console.error("[worker] Outbox dispatch failed:", error instanceof Error ? error.message : "Unknown error");
  }
}

const outboxTimer = setInterval(() => void dispatchOutbox(), 2_000);
outboxTimer.unref();
void dispatchOutbox();

async function recoverStaleRuns() {
  const recovered = await recoverStaleWorkflowRuns(prisma);
  if (recovered > 0) {
    console.warn(`[worker] marked ${recovered} stale run(s) as failed; no external action was retried`);
  }
}

const recoveryTimer = setInterval(() => {
  void recoverStaleRuns().catch((error: unknown) => {
    console.error("[worker] Stale-run recovery failed:", error instanceof Error ? error.message : "Unknown error");
  });
}, 60_000);
recoveryTimer.unref();
void recoverStaleRuns().catch((error: unknown) => {
  console.error("[worker] Initial stale-run recovery failed:", error instanceof Error ? error.message : "Unknown error");
});

async function shutdown(signal: string) {
  console.info(`[worker] ${signal} received; closing gracefully`);
  clearInterval(recoveryTimer);
  clearInterval(outboxTimer);
  clearInterval(scheduleSyncTimer);
  await scheduleWorker.close();
  await getScheduleQueue().close();
  await worker.close();
  await dispatchQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
