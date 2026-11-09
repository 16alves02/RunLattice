import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { signWebhookPayload } from "@/lib/webhook-signature";
import { getScheduleQueue, syncWorkflowSchedule } from "@/lib/schedule";
import { POST as receiveWebhook } from "@/app/api/webhooks/[workflowId]/route";
import type { WorkflowDefinition } from "@/lib/types";

const organizationId = `integration-org-${randomBytes(8).toString("hex")}`;
const webhookWorkflowId = `integration-webhook-${randomBytes(8).toString("hex")}`;
const workerWorkflowId = `integration-worker-${randomBytes(8).toString("hex")}`;
const successfulWorkflowId = `integration-success-${randomBytes(8).toString("hex")}`;
const successfulConnectionId = `integration-connection-${randomBytes(8).toString("hex")}`;
const httpWorkflowId = `integration-http-${randomBytes(8).toString("hex")}`;
const httpConnectionId = `integration-http-connection-${randomBytes(8).toString("hex")}`;
let workerProcess: ChildProcess | undefined;

describe("RunLattice PostgreSQL, API and worker integration", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
      throw new Error("DATABASE_URL and REDIS_URL are required for integration tests.");
    }
    process.env.INTEGRATION_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
    await prisma.organization.create({
      data: { id: organizationId, name: "Integration Test Workspace", slug: `it-${randomBytes(6).toString("hex")}` },
    });
  });

  afterAll(async () => {
    if (workerProcess && workerProcess.exitCode === null) {
      workerProcess.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((resolve) => workerProcess?.once("exit", () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    await getScheduleQueue().close();
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("accepts only signed webhook requests and persists the run and outbox event", async () => {
    const secret = randomBytes(32).toString("base64url");
    const definition = {
      nodes: [{ id: "trigger", kind: "trigger", title: "Webhook", detail: "Trigger · WEBHOOK", config: { triggerType: "WEBHOOK" }, x: 0, y: 0 }],
      edges: [],
    };
    await prisma.workflow.create({
      data: {
        id: webhookWorkflowId,
        name: "Signed webhook integration",
        description: "",
        status: "ACTIVE",
        triggerType: "WEBHOOK",
        definition,
        organizationId,
        webhookSecretCiphertext: encryptSecret(secret, `${organizationId}:workflow-webhook:${webhookWorkflowId}`),
      },
    });

    const body = JSON.stringify({ event: "order.created", orderId: "ord_test_123" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const deliveryId = `delivery_${randomBytes(8).toString("hex")}`;
    const signature = `v1=${signWebhookPayload(secret, timestamp, deliveryId, body)}`;
    const request = new Request(`https://runlattice.test/api/webhooks/${webhookWorkflowId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-runlattice-timestamp": timestamp, "x-runlattice-delivery-id": deliveryId, "x-runlattice-signature": signature },
      body,
    });
    const accepted = await receiveWebhook(request, { params: Promise.resolve({ workflowId: webhookWorkflowId }) });
    expect(accepted.status).toBe(202);

    const run = await prisma.workflowRun.findFirst({
      where: { workflowId: webhookWorkflowId },
      include: { outboxEvent: true },
    });
    expect(run?.status).toBe("QUEUED");
    expect(run?.input).toEqual({ event: "order.created", orderId: "ord_test_123" });
    expect(run?.outboxEvent).not.toBeNull();

    const rejected = await receiveWebhook(new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-runlattice-timestamp": timestamp, "x-runlattice-delivery-id": deliveryId, "x-runlattice-signature": "v1=" + "0".repeat(64) },
      body,
    }), { params: Promise.resolve({ workflowId: webhookWorkflowId }) });
    expect(rejected.status).toBe(401);
    const replay = await receiveWebhook(new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-runlattice-timestamp": timestamp,
        "x-runlattice-delivery-id": deliveryId,
        "x-runlattice-signature": signature,
      },
      body,
    }), { params: Promise.resolve({ workflowId: webhookWorkflowId }) });
    expect(replay.status).toBe(409);
    expect(await prisma.workflowRun.count({ where: { workflowId: webhookWorkflowId } })).toBe(1);
  });


  it("registers and removes a cron scheduler in the shared Redis service", async () => {
    const workflowId = `integration-schedule-${randomBytes(8).toString("hex")}`;
    const definition: WorkflowDefinition = {
      nodes: [{
        id: "trigger",
        kind: "trigger",
        title: "Daily schedule",
        detail: "Trigger · SCHEDULE",
        config: { triggerType: "SCHEDULE", cronExpression: "*/10 * * * *", timezone: "Europe/Lisbon" },
        x: 0,
        y: 0,
      }],
      edges: [],
    };
    await syncWorkflowSchedule({ workflowId, status: "ACTIVE", triggerType: "SCHEDULE", definition });
    const scheduler = await getScheduleQueue().getJobScheduler(`workflow:${workflowId}`);
    expect(scheduler).not.toBeNull();
    const removed = await syncWorkflowSchedule({ workflowId, status: "PAUSED", triggerType: "SCHEDULE", definition });
    expect(removed).toBe(true);
  });

  function startWorkerProcess() {
    if (workerProcess && workerProcess.exitCode === null) return;
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    workerProcess = spawn(npm, ["run", "worker"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import=./tests/mocks/mock-discord-fetch.mjs", "--import=./tests/mocks/mock-http-https.mjs"].filter(Boolean).join(" "),
      },
      stdio: "ignore",
      shell: process.platform === "win32",
    });
  }

  async function waitForRunStatus(runId: string, expected: "SUCCEEDED" | "FAILED") {
    const deadline = Date.now() + 25_000;
    let status = "QUEUED";
    while (Date.now() < deadline && status !== expected) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await prisma.workflowRun.findUnique({ where: { id: runId }, select: { status: true } });
      status = current?.status ?? "MISSING";
      if (status === "FAILED" && expected === "SUCCEEDED") break;
    }
    return status;
  }

  it("executes a valid persisted workflow through the real BullMQ worker", async () => {
    const webhookUrl = `https://discord.com/api/webhooks/123456789012/${randomBytes(24).toString("hex")}`;
    await prisma.integrationConnection.create({
      data: {
        id: successfulConnectionId,
        organizationId,
        provider: "discord",
        name: "Mock Discord",
        credentialsCiphertext: encryptSecret(JSON.stringify({ webhookUrl }), `${organizationId}:discord`),
      },
    });
    await prisma.workflow.create({
      data: {
        id: successfulWorkflowId,
        name: "Worker integration success path",
        description: "",
        status: "ACTIVE",
        triggerType: "MANUAL",
        definition: {
          nodes: [
            {
              id: "trigger",
              kind: "trigger",
              title: "Manual trigger",
              detail: "Trigger · MANUAL",
              config: { triggerType: "MANUAL" },
              x: 0,
              y: 0,
            },
            {
              id: "discord-action",
              kind: "action",
              title: "Send Discord message",
              detail: "Discord · Send message",
              config: { integrationId: "discord", actionId: "send_message", connectionId: successfulConnectionId, message: "Integration test succeeded" },
              x: 320,
              y: 0,
            },
          ],
          edges: [{ id: "trigger-to-action", from: "trigger", to: "discord-action" }],
        },
        organizationId,
      },
    });
    const run = await prisma.workflowRun.create({
      data: { workflowId: successfulWorkflowId, outboxEvent: { create: {} } },
    });

    startWorkerProcess();
    expect(await waitForRunStatus(run.id, "SUCCEEDED")).toBe("SUCCEEDED");
    const completed = await prisma.workflowRun.findUnique({ where: { id: run.id } });
    expect(completed?.finishedAt).toBeInstanceOf(Date);
    expect(completed?.output).toMatchObject({ executionMode: "LIVE", message: "Workflow actions completed successfully." });
  });

  it("executes a secured HTTP request and routes a condition from its mapped response in the real worker", async () => {
    const baseUrl = "https://93.184.216.34/v1";
    await prisma.integrationConnection.create({
      data: {
        id: httpConnectionId,
        organizationId,
        provider: "http",
        name: "Mock HTTP API",
        credentialsCiphertext: encryptSecret(JSON.stringify({
          baseUrl,
          apiKey: "integration-test-secret",
          apiKeyHeader: "authorization",
        }), `${organizationId}:http`),
      },
    });
    await prisma.workflow.create({
      data: {
        id: httpWorkflowId,
        name: "HTTP response condition integration",
        description: "",
        status: "ACTIVE",
        triggerType: "MANUAL",
        organizationId,
        definition: {
          nodes: [
            {
              id: "trigger",
              kind: "trigger",
              title: "Manual trigger",
              detail: "Trigger · MANUAL",
              config: { triggerType: "MANUAL" },
              x: 0,
              y: 0,
            },
            {
              id: "http-action",
              kind: "action",
              title: "Get invoice",
              detail: "HTTP · Request",
              config: {
                integrationId: "http",
                actionId: "request",
                connectionId: httpConnectionId,
                method: "GET",
                url: `${baseUrl}/invoices/123`,
                responsePath: "data.amount",
              },
              x: 320,
              y: 0,
            },
            {
              id: "condition",
              kind: "condition",
              title: "Check invoice amount",
              detail: "Condition · greater than 100",
              config: { path: "steps.http-action.responseValue", operator: "greater_than", value: 100 },
              x: 640,
              y: 0,
            },
            {
              id: "high-action",
              kind: "action",
              title: "Notify high-value invoice",
              detail: "Discord · Send message",
              config: {
                integrationId: "discord",
                actionId: "send_message",
                connectionId: successfulConnectionId,
                message: "High-value invoice: {{input.steps.http-action.responseValue}}",
              },
              x: 960,
              y: -100,
            },
            {
              id: "low-action",
              kind: "action",
              title: "Notify low-value invoice",
              detail: "Discord · Send message",
              config: {
                integrationId: "discord",
                actionId: "send_message",
                connectionId: successfulConnectionId,
                message: "Low-value invoice",
              },
              x: 960,
              y: 100,
            },
          ],
          edges: [
            { id: "start-http", from: "trigger", to: "http-action" },
            { id: "http-condition", from: "http-action", to: "condition" },
            { id: "condition-true", from: "condition", to: "high-action", branch: "true" },
            { id: "condition-false", from: "condition", to: "low-action", branch: "false" },
          ],
        },
      },
    });
    const run = await prisma.workflowRun.create({
      data: { workflowId: httpWorkflowId, input: {}, outboxEvent: { create: {} } },
    });

    startWorkerProcess();
    const status = await waitForRunStatus(run.id, "SUCCEEDED");
    const completed = await prisma.workflowRun.findUnique({ where: { id: run.id } });
    expect(status, `HTTP workflow failed: ${completed?.error ?? "no worker error was persisted"}`).toBe("SUCCEEDED");
    const persistedSteps = await prisma.workflowRunStep.findMany({
      where: { runId: run.id },
      orderBy: { startedAt: "asc" },
    });
    expect(persistedSteps.map((step) => step.nodeId)).toEqual([
      "trigger", "http-action", "condition", "high-action",
    ]);
    expect(persistedSteps.find((step) => step.nodeId === "http-action")?.result).toEqual({ httpStatus: 200 });
    expect(JSON.stringify(completed?.output)).not.toContain("inv_mock_123");
    expect(JSON.stringify(completed?.output)).not.toContain("integration-test-secret");
  });

  it("records an invalid workflow failure safely in the real BullMQ worker", async () => {
    await prisma.workflow.create({
      data: {
        id: workerWorkflowId,
        name: "Worker integration failure path",
        description: "",
        status: "ACTIVE",
        triggerType: "MANUAL",
        definition: { nodes: [], edges: [] },
        organizationId,
      },
    });
    const run = await prisma.workflowRun.create({
      data: { workflowId: workerWorkflowId, outboxEvent: { create: {} } },
    });

    startWorkerProcess();
    expect(await waitForRunStatus(run.id, "FAILED")).toBe("FAILED");
  });
});
