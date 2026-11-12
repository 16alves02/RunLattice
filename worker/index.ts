import { Queue, Worker, type Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { decryptSecret } from "../src/lib/secrets";
import { recoverStaleWorkflowRuns } from "../src/lib/run-recovery";
import { dispatchPendingWorkflowRuns } from "../src/lib/outbox";
import { createQuotaBoundWorkflowRun } from "../src/lib/run-quota";
import { PLAN_LIMITS, resolveEntitledPlan } from "../src/lib/billing-core";
import { renderInputTemplate } from "../src/lib/template";
import { resolveNextExecutionNode, validateExecutableWorkflow } from "../src/lib/execution";
import { evaluateCondition } from "../src/lib/condition";
import { workflowDefinitionSchema, createIntegrationConnectionSchema } from "../src/lib/validation";
import type { DiscordActionConfig, HttpActionConfig, WorkflowDefinition } from "../src/lib/types";
import { ActionOutcomeUnknownError, isWithinAllowedHttpsBase, requestPublicHttps } from "../src/lib/safe-http";
import { extractJsonResponseValue, toPersistableHttpActionResult } from "../src/lib/http-response";
import { getScheduleQueue, syncWorkflowSchedule } from "../src/lib/schedule";

const prisma = new PrismaClient();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URI.");
}
void prisma.$connect().then(() => {
  console.info("[worker] PostgreSQL connection established.");
}).catch((error: unknown) => {
  console.error("[worker] PostgreSQL connection failed:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
});
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
  if (!validated.success || typeof webhookUrl !== "string") {
    throw new Error("The stored Discord webhook URL is invalid.");
  }

  return webhookUrl;
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
    throw new ActionOutcomeUnknownError("Discord did not respond within the 10-second action timeout; delivery outcome may be unknown.");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Discord returned a redirect, which is blocked for security.");
  }
  if (!response.ok) {
    throw new Error(`Discord rejected the message with HTTP ${response.status}.`);
  }

  return { httpStatus: response.status };
}

async function executeHttpAction(config: HttpActionConfig, organizationId: string, input: unknown) {
  if (!config.connectionId || !config.url.trim()) {
    throw new Error("The HTTP action is missing its connection or destination URL.");
  }

  const integrationConnection = await prisma.integrationConnection.findFirst({
    where: {
      id: config.connectionId,
      organizationId,
      provider: "http",
    },
    select: { credentialsCiphertext: true },
  });
  if (!integrationConnection) throw new Error("The HTTP API connection is unavailable in this workspace.");

  let credentials: unknown;
  try {
    credentials = JSON.parse(decryptSecret(integrationConnection.credentialsCiphertext, `${organizationId}:http`));
  } catch {
    throw new Error("The stored HTTP API credentials could not be decrypted.");
  }

  if (!credentials || typeof credentials !== "object" || !("apiKey" in credentials)
    || typeof credentials.apiKey !== "string" || !credentials.apiKey
    || !("apiKeyHeader" in credentials)
    || (credentials.apiKeyHeader !== "authorization" && credentials.apiKeyHeader !== "x-api-key")
    || !("baseUrl" in credentials) || typeof credentials.baseUrl !== "string") {
    throw new Error("The stored HTTP API credentials are invalid.");
  }

  const url = renderInputTemplate(config.url, input, 2_000);
  if (!isWithinAllowedHttpsBase(credentials.baseUrl, url)) {
    throw new Error("The HTTP action destination must remain inside the HTTPS origin and base path configured for this API connection.");
  }
  const body = config.body ? renderInputTemplate(config.body, input, 65_536, true) : "";
  if (body) {
    try { JSON.parse(body); }
    catch { throw new Error("The rendered HTTP request body must be valid JSON."); }
  }
  let response;
  try {
    response = await requestPublicHttps({
      url,
      method: config.method,
      headers: {
        [credentials.apiKeyHeader]: credentials.apiKey,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
    });
  } catch (error) {
    if (error instanceof ActionOutcomeUnknownError) throw error;
    throw new Error("The external HTTPS request failed or was blocked by RunLattice security controls.");
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`The external API returned HTTP ${response.status}.`);
  }
  if (config.responsePath?.trim()) {
    const responseValue = extractJsonResponseValue(response.body, config.responsePath.trim());
    return { httpStatus: response.status, responseValue };
  }
  return { httpStatus: response.status };
}

async function executeAction(node: WorkflowDefinition["nodes"][number], organizationId: string, input: unknown) {
  if (!node.config || !("integrationId" in node.config) || !node.config.connectionId) {
    throw new Error(`Action "${node.title}" has not been configured.`);
  }
  if (node.config.integrationId === "discord" && node.config.actionId === "send_message") {
    if (!node.config.message?.trim()) throw new Error("The Discord action is missing its message.");
    return executeDiscordAction(node.config, organizationId, input);
  }
  if (node.config.integrationId === "http" && node.config.actionId === "request") {
    return executeHttpAction(node.config, organizationId, input);
  }
  throw new Error(`Action "${node.title}" is not supported by this worker version.`);
}

const dispatchQueue = new Queue<WorkflowJob>("workflow-runs", { connection });

const workerHeartbeatKey = "runlattice:worker:heartbeat";
async function refreshWorkerHeartbeat() {
  try {
    const client = await dispatchQueue.client as unknown as {
      set: (key: string, value: string, expiryMode: "EX", ttl: number) => Promise<unknown>;
    };
    await client.set(workerHeartbeatKey, Date.now().toString(), "EX", 90);
  } catch (error) {
    console.error("[worker] Unable to refresh service heartbeat:", error instanceof Error ? error.message : "Unknown error");
  }
}
const workerHeartbeatTimer = setInterval(() => void refreshWorkerHeartbeat(), 30_000);
workerHeartbeatTimer.unref();
void refreshWorkerHeartbeat();

const scheduleWorker = new Worker<{ workflowId: string }>("workflow-schedules", async (job) => {
  if (job.name !== "scheduled-trigger" || !job.data.workflowId) return { skipped: true };
  const workflow = await prisma.workflow.findFirst({
    where: { id: job.data.workflowId, status: "ACTIVE", triggerType: "SCHEDULE" },
    select: { id: true, organizationId: true, definition: true },
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

  if (!workflow.organizationId) return { skipped: true, reason: "Scheduled workflow has no workspace." };
  const quota = await createQuotaBoundWorkflowRun({
    organizationId: workflow.organizationId,
    create: (transaction) => transaction.workflowRun.create({
      data: {
        workflowId: workflow.id,
        input: { triggerType: "SCHEDULE", scheduledAt: new Date().toISOString() },
        outboxEvent: { create: {} },
      },
      select: { id: true },
    }),
  });
  if (!quota.allowed) {
    console.warn(`[scheduler] skipped scheduled run for workspace at monthly quota (${quota.used}/${quota.limit})`);
    return { skipped: true, reason: "Workspace monthly run quota reached." };
  }
  console.info(`[scheduler] queued scheduled run ${quota.data.id}`);
  return { runId: quota.data.id };
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

  const admissionWorkflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { status: true, organizationId: true },
  });
  if (!admissionWorkflow || admissionWorkflow.status !== "ACTIVE" || !admissionWorkflow.organizationId) {
    await prisma.workflowRun.updateMany({
      where: { id: runId, workflowId, status: "QUEUED" },
      data: { status: "CANCELLED", finishedAt: new Date(), error: "Workflow is unavailable, inactive or not assigned to a workspace." },
    });
    return { skipped: true, reason: "Workflow is unavailable, inactive or not assigned to a workspace." };
  }

  // Admission and the RUNNING transition share a workspace lock, so workers
  // cannot race past the plan's concurrency ceiling.
  const leaseToken = randomUUID();
  const admission = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${admissionWorkflow.organizationId!}, 0))::text AS lock_value`;
    const subscription = await transaction.billingSubscription.findUnique({
      where: { organizationId: admissionWorkflow.organizationId! },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });
    const plan = resolveEntitledPlan(subscription);
    const limit = PLAN_LIMITS[plan].concurrentRuns;
    const running = await transaction.workflowRun.count({
      where: { status: "RUNNING", workflow: { organizationId: admissionWorkflow.organizationId! } },
    });
    if (running >= limit) return { claimed: false, capacityReached: true as const };

    const result = await transaction.workflowRun.updateMany({
      where: { id: runId, workflowId, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), heartbeatAt: new Date(), leaseToken, error: null },
    });
    return { claimed: result.count === 1, capacityReached: false as const };
  });

  if (!admission.claimed && admission.capacityReached) {
    try {
      await dispatchQueue.add(
        "execute-workflow",
        { runId, workflowId },
        {
          jobId: `${runId}-capacity-${Math.floor(Date.now() / 5_000)}`,
          delay: 5_000,
          attempts: 1,
          removeOnComplete: 500,
          removeOnFail: 1_000,
        },
      );
      return { deferred: true, reason: "Workspace concurrency limit reached; run deferred." };
    } catch (error) {
      await prisma.workflowRun.updateMany({
        where: { id: runId, workflowId, status: "QUEUED" },
        data: { status: "FAILED", finishedAt: new Date(), error: "The run could not be deferred while the workspace concurrency limit was reached." },
      });
      throw error;
    }
  }
  if (!admission.claimed) return { skipped: true, reason: "Run was already claimed or completed." };

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
  const executionContext: Record<string, unknown> = run.input && typeof run.input === "object" && !Array.isArray(run.input)
    ? { ...(run.input as Record<string, unknown>), steps: {} }
    : { value: run.input, steps: {} };
  try {
    const parsedDefinition = workflowDefinitionSchema.safeParse(workflow.definition);
    if (!parsedDefinition.success) throw new Error("The saved workflow definition is invalid.");

    const definition = parsedDefinition.data as WorkflowDefinition;
    validateExecutableWorkflow(definition);
    let currentNode = definition.nodes.find((node) => node.kind === "trigger");
    const visitedNodes = new Set<string>();
    while (currentNode) {
      const node = currentNode;
      if (visitedNodes.has(node.id)) throw new Error("Workflow connections contain a cycle.");
      visitedNodes.add(node.id);
      const startedAt = new Date().toISOString();
      if (!(await ownsLease())) throw new Error("Execution lease was lost; this worker stopped.");
      await job.updateProgress({ currentNode: node.id, completed: steps.length, total: definition.nodes.length });
      // Lock the run row while checking the fencing token and creating the
      // ledger entry. Recovery uses the same row lock through its status update,
      // so it cannot mark the run stale between lease validation and step creation.
      const ledgerStep = await prisma.$transaction(async (transaction) => {
        const leaseRows = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "WorkflowRun"
          WHERE "id" = ${runId}
            AND "status" = 'RUNNING'
            AND "leaseToken" = ${leaseToken}
          FOR UPDATE
        `;
        if (leaseRows.length === 0) return null;

        return transaction.workflowRunStep.create({
          data: { runId, nodeId: node.id, title: node.title, kind: node.kind, status: "RUNNING" },
        });
      });
      if (!ledgerStep) {
        throw new Error("Execution lease was lost before the step record could be created.");
      }

      try {
        let result: ExecutionStep["result"];
        if (node.kind === "trigger") {
          result = {};
        } else if (node.kind === "condition") {
          if (!node.config || !("operator" in node.config)) throw new Error(`Condition "${node.title}" has no valid rule.`);
          result = { condition: evaluateCondition(node.config, executionContext) };
        } else {
          if (!(await ownsLease())) throw new Error("Execution lease was lost before the external action.");
          result = await executeAction(node, workflow.organizationId, executionContext);
        }

        if (result && typeof result === "object" && !Array.isArray(result)) {
          (executionContext.steps as Record<string, unknown>)[node.id] = result;
        }
        const persistedResult = result && typeof result === "object" && !Array.isArray(result)
          && "responseValue" in result
          ? toPersistableHttpActionResult(result as { httpStatus: number; responseValue?: string | number | boolean | null })
          : result;
        await prisma.workflowRunStep.update({
          where: { id: ledgerStep.id, run: { is: { status: "RUNNING", leaseToken } } },
          data: { status: "SUCCEEDED", finishedAt: new Date(), result: persistedResult ?? {} },
        });
        steps.push({
          nodeId: node.id,
          title: node.title,
          status: "SUCCEEDED",
          startedAt,
          finishedAt: new Date().toISOString(),
          ...(persistedResult ? { result: persistedResult } : {}),
        });
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : "The workflow step failed.";
        await prisma.workflowRunStep.update({
          where: { id: ledgerStep.id, run: { is: { status: "RUNNING", leaseToken } } },
          data: {
            status: node.kind === "action" && error instanceof ActionOutcomeUnknownError ? "OUTCOME_UNKNOWN" : "FAILED",
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
      currentNode = resolveNextExecutionNode(definition, node, executionContext);
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
}, { connection, concurrency: 10 });

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
  clearInterval(workerHeartbeatTimer);
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
