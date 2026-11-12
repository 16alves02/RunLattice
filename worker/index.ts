import { Queue, Worker, type Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "../src/lib/secrets";
import { recoverStaleWorkflowRuns } from "../src/lib/run-recovery";
import { createRunStepIfLeaseOwned } from "../src/lib/run-lease";
import { dispatchPendingWorkflowRuns } from "../src/lib/outbox";
import { createQuotaBoundWorkflowRun } from "../src/lib/run-quota";
import { PLAN_LIMITS, resolveEntitledPlan } from "../src/lib/billing-core";
import { renderInputTemplate } from "../src/lib/template";
import { resolveNextExecutionNode, validateExecutableWorkflow } from "../src/lib/execution";
import { evaluateCondition } from "../src/lib/condition";
import { workflowDefinitionSchema, createIntegrationConnectionSchema } from "../src/lib/validation";
import type { DiscordActionConfig, SlackActionConfig, GmailActionConfig, GoogleSheetsAppendConfig, GoogleSheetsReadConfig, HttpActionConfig, WorkflowDefinition } from "../src/lib/types";
import { ActionOutcomeUnknownError, isWithinAllowedHttpsBase, requestPublicHttps } from "../src/lib/safe-http";
import { extractJsonResponseValue, toPersistableHttpActionResult } from "../src/lib/http-response";
import { getScheduleQueue, syncWorkflowSchedule } from "../src/lib/schedule";
import { isIntegrationActionAvailable } from "../src/lib/integrations";
import { buildGmailRawMessage } from "../src/lib/gmail-message";
import { parseGoogleSheetsAppendResponse, parseGoogleSheetsAppendValues, parseGoogleSheetsReadResponse, readGoogleSheetsJsonResponse } from "../src/lib/google-sheets";
import { buildSlackMessagePayload, parseSlackMessageResponse } from "../src/lib/slack-message";

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
  result?: Prisma.InputJsonObject;
  error?: string;
}

function serializeSteps(steps: ExecutionStep[]): Prisma.InputJsonArray {
  return steps.map((step): Prisma.InputJsonObject => ({
    nodeId: step.nodeId,
    title: step.title,
    status: step.status,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    ...(step.result ? { result: step.result } : {}),
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

async function getGoogleAccessToken(connectionId: string, organizationId: string, requiredScope: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId, provider: "google" },
    select: { id: true, credentialsCiphertext: true },
  });
  if (!connection) throw new Error("The Google account connection is unavailable in this workspace.");

  let credentials: unknown;
  try {
    credentials = JSON.parse(decryptSecret(connection.credentialsCiphertext, `${organizationId}:google`));
  } catch {
    throw new Error("The stored Google account credentials could not be decrypted.");
  }
  if (!credentials || typeof credentials !== "object"
    || !("accessToken" in credentials) || typeof credentials.accessToken !== "string"
    || !("refreshToken" in credentials) || typeof credentials.refreshToken !== "string"
    || !("expiresAt" in credentials) || typeof credentials.expiresAt !== "string"
    || !("scope" in credentials) || typeof credentials.scope !== "string"
    || !credentials.refreshToken) {
    throw new Error("The stored Google account credentials are invalid.");
  }
  if (!credentials.scope.split(" ").includes(requiredScope)) {
    throw new Error("This Google account has not granted the permission required for this action. Reconnect it from Integrations.");
  }

  const expiresAt = Date.parse(credentials.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error("The stored Google token expiry is invalid.");
  if (expiresAt > Date.now() + 60_000) return credentials.accessToken;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client credentials are not configured on the worker.");

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Google could not refresh the account access token.");
  }
  if (!response.ok) throw new Error("Google rejected the account refresh token. Reconnect this Google account.");
  const refreshed: unknown = await response.json();
  if (!refreshed || typeof refreshed !== "object" || !("access_token" in refreshed)
    || typeof refreshed.access_token !== "string" || !refreshed.access_token
    || !("expires_in" in refreshed) || typeof refreshed.expires_in !== "number"
    || refreshed.expires_in < 60 || refreshed.expires_in > 86_400) {
    throw new Error("Google returned an invalid refreshed access token.");
  }

  const updatedCredentials = {
    ...credentials,
    accessToken: refreshed.access_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
  const updatedCiphertext = encryptSecret(JSON.stringify(updatedCredentials), `${organizationId}:google`);
  await prisma.integrationConnection.updateMany({
    where: { id: connection.id, organizationId, provider: "google", credentialsCiphertext: connection.credentialsCiphertext },
    data: { credentialsCiphertext: updatedCiphertext },
  });
  return refreshed.access_token;
}

async function getSlackAccessToken(connectionId: string, organizationId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId, provider: "slack" },
    select: { id: true, credentialsCiphertext: true },
  });
  if (!connection) throw new Error("The Slack workspace connection is unavailable in this workspace.");

  let credentials: unknown;
  try { credentials = JSON.parse(decryptSecret(connection.credentialsCiphertext, `${organizationId}:slack`)); }
  catch { throw new Error("The stored Slack workspace credentials could not be decrypted."); }
  if (!credentials || typeof credentials !== "object"
    || !("accessToken" in credentials) || typeof credentials.accessToken !== "string" || !credentials.accessToken
    || !("scope" in credentials) || typeof credentials.scope !== "string"
    || !("teamId" in credentials) || typeof credentials.teamId !== "string") {
    throw new Error("The stored Slack workspace credentials are invalid.");
  }
  if (!credentials.scope.split(",").map((scope) => scope.trim()).includes("chat:write")) {
    throw new Error("The Slack app has not granted chat:write. Reconnect the Slack workspace.");
  }

  const expiresAt = "expiresAt" in credentials && typeof credentials.expiresAt === "string"
    ? Date.parse(credentials.expiresAt) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(expiresAt) && expiresAt !== Number.POSITIVE_INFINITY) {
    throw new Error("The stored Slack token expiry is invalid.");
  }
  if (expiresAt > Date.now() + 60_000) return credentials.accessToken;
  if (!("refreshToken" in credentials) || typeof credentials.refreshToken !== "string" || !credentials.refreshToken) {
    throw new Error("The Slack bot token has expired. Reconnect the Slack workspace.");
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Slack OAuth client credentials are not configured on the worker.");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  let response: Response;
  try {
    response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { authorization: `Basic ${basicAuth}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credentials.refreshToken }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Slack could not refresh the workspace access token.");
  }
  if (!response.ok) throw new Error("Slack rejected the workspace token refresh. Reconnect the Slack workspace.");
  const refreshed: unknown = await response.json();
  if (!refreshed || typeof refreshed !== "object" || !("ok" in refreshed) || refreshed.ok !== true
    || !("access_token" in refreshed) || typeof refreshed.access_token !== "string" || !refreshed.access_token
    || !("expires_in" in refreshed) || typeof refreshed.expires_in !== "number"
    || refreshed.expires_in < 60 || refreshed.expires_in > 86_400
    || !("refresh_token" in refreshed) || typeof refreshed.refresh_token !== "string" || !refreshed.refresh_token) {
    throw new Error("Slack returned an invalid rotated access token.");
  }

  const updatedCredentials = {
    ...credentials,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
  const updatedCiphertext = encryptSecret(JSON.stringify(updatedCredentials), `${organizationId}:slack`);
  const updated = await prisma.integrationConnection.updateMany({
    where: { id: connection.id, organizationId, provider: "slack", credentialsCiphertext: connection.credentialsCiphertext },
    data: { credentialsCiphertext: updatedCiphertext },
  });
  if (updated.count === 1) return refreshed.access_token;

  const latest = await prisma.integrationConnection.findFirst({
    where: { id: connection.id, organizationId, provider: "slack" },
    select: { credentialsCiphertext: true },
  });
  if (!latest) throw new Error("The Slack workspace connection was removed during token refresh.");
  try {
    const latestCredentials: unknown = JSON.parse(decryptSecret(latest.credentialsCiphertext, `${organizationId}:slack`));
    if (latestCredentials && typeof latestCredentials === "object"
      && "accessToken" in latestCredentials && typeof latestCredentials.accessToken === "string"
      && "expiresAt" in latestCredentials && typeof latestCredentials.expiresAt === "string"
      && Date.parse(latestCredentials.expiresAt) > Date.now() + 60_000) return latestCredentials.accessToken;
  } catch {
    throw new Error("The refreshed Slack workspace credentials could not be read.");
  }
  throw new Error("Slack token refresh conflicted with another worker. Retry the workflow.");
}

async function executeSlackAction(config: SlackActionConfig, organizationId: string, input: unknown) {
  if (!config.connectionId) throw new Error("The Slack action is missing its workspace connection.");
  const channel = renderInputTemplate(config.channel, input, 40);
  const message = renderInputTemplate(config.message, input, 40_000);
  const payload = buildSlackMessagePayload(channel, message);
  const accessToken = await getSlackAccessToken(config.connectionId, organizationId);

  let response: Response;
  try {
    response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ActionOutcomeUnknownError("Slack did not respond within the 15-second send timeout; message delivery may be unknown. RunLattice will not automatically resend it.");
  }
  if (!response.ok) throw new Error(`Slack rejected the message with HTTP ${response.status}.`);
  const result: unknown = await response.json();
  return parseSlackMessageResponse(result);
}

async function executeGmailAction(config: GmailActionConfig, organizationId: string, input: unknown) {
  if (!config.connectionId) throw new Error("The Gmail action is missing its Google account connection.");
  const toValue = renderInputTemplate(config.to, input, 1_000);
  const subject = renderInputTemplate(config.subject, input, 500);
  const body = renderInputTemplate(config.body, input, 100_000);
  const raw = buildGmailRawMessage(toValue, subject, body);
  const accessToken = await getGoogleAccessToken(config.connectionId, organizationId, "https://www.googleapis.com/auth/gmail.send");

  let response: Response;
  try {
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ActionOutcomeUnknownError("Gmail did not respond within the 15-second send timeout; the email delivery outcome may be unknown.");
  }
  if (!response.ok) throw new Error(`Gmail rejected the email with HTTP ${response.status}. Reconnect the account if Google reports an authorization error.`);
  return { httpStatus: response.status };
}

async function executeGoogleSheetsRead(config: GoogleSheetsReadConfig, organizationId: string) {
  if (!config.connectionId) throw new Error("The Google Sheets action is missing its Google account connection.");
  const accessToken = await getGoogleAccessToken(config.connectionId, organizationId, "https://www.googleapis.com/auth/spreadsheets");
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}`);
  url.searchParams.set("majorDimension", "ROWS");
  let response: Response;
  try {
    response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error("Google Sheets read request timed out or could not be completed.");
  }
  if (!response.ok) throw new Error(`Google Sheets rejected the read request with HTTP ${response.status}.`);
  const payload = await readGoogleSheetsJsonResponse(response);
  return parseGoogleSheetsReadResponse(payload);
}

async function executeGoogleSheetsAppend(config: GoogleSheetsAppendConfig, organizationId: string, input: unknown) {
  if (!config.connectionId) throw new Error("The Google Sheets action is missing its Google account connection.");
  const rendered = renderInputTemplate(config.valuesJson, input, 65_536, true);
  const values = parseGoogleSheetsAppendValues(rendered);
  const accessToken = await getGoogleAccessToken(config.connectionId, organizationId, "https://www.googleapis.com/auth/spreadsheets");
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.range)}:append`);
  url.searchParams.set("valueInputOption", "RAW");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  url.searchParams.set("includeValuesInResponse", "false");
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ActionOutcomeUnknownError("Google Sheets did not respond within the 15-second append timeout; rows may have been added. RunLattice will not automatically retry this operation.");
  }
  if (!response.ok) throw new Error(`Google Sheets rejected the append request with HTTP ${response.status}.`);
  const payload = await readGoogleSheetsJsonResponse(response);
  return parseGoogleSheetsAppendResponse(payload);
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
  if (!isIntegrationActionAvailable(node.config.integrationId, node.config.actionId)) {
    throw new Error(`Action "${node.title}" uses an integration operation that is not available.`);
  }
  if (node.config.integrationId === "discord" && node.config.actionId === "send_message") {
    if (!node.config.message?.trim()) throw new Error("The Discord action is missing its message.");
    return executeDiscordAction(node.config, organizationId, input);
  }
  if (node.config.integrationId === "slack" && node.config.actionId === "send_message") {
    return executeSlackAction(node.config, organizationId, input);
  }
  if (node.config.integrationId === "gmail" && node.config.actionId === "send_email") {
    return executeGmailAction(node.config, organizationId, input);
  }
  if (node.config.integrationId === "google-sheets" && node.config.actionId === "read_rows") {
    return executeGoogleSheetsRead(node.config, organizationId);
  }
  if (node.config.integrationId === "google-sheets" && node.config.actionId === "append_rows") {
    return executeGoogleSheetsAppend(node.config, organizationId, input);
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
      const ledgerStep = await createRunStepIfLeaseOwned(prisma, {
        runId,
        leaseToken,
        nodeId: node.id,
        title: node.title,
        kind: node.kind,
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
