import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { signWebhookPayload } from "@/lib/webhook-signature";
import { getScheduleQueue, syncWorkflowSchedule } from "@/lib/schedule";
import { POST as receiveWebhook } from "@/app/api/webhooks/[workflowId]/route";

const organizationId = `integration-org-${randomBytes(8).toString("hex")}`;
const webhookWorkflowId = `integration-webhook-${randomBytes(8).toString("hex")}`;
const workerWorkflowId = `integration-worker-${randomBytes(8).toString("hex")}`;
let workerProcess: ChildProcess | undefined;

describe.sequential("RunLattice PostgreSQL, API and worker integration", () => {
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
    const signature = `v1=${signWebhookPayload(secret, timestamp, body)}`;
    const request = new Request(`https://runlattice.test/api/webhooks/${webhookWorkflowId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-runlattice-timestamp": timestamp, "x-runlattice-signature": signature },
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
      headers: { "content-type": "application/json", "x-runlattice-timestamp": timestamp, "x-runlattice-signature": "v1=" + "0".repeat(64) },
      body,
    }), { params: Promise.resolve({ workflowId: webhookWorkflowId }) });
    expect(rejected.status).toBe(401);
    expect(await prisma.workflowRun.count({ where: { workflowId: webhookWorkflowId } })).toBe(1);
  });


  it("registers and removes a cron scheduler in the shared Redis service", async () => {
    const workflowId = `integration-schedule-${randomBytes(8).toString("hex")}`;
    const definition = {
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
    await syncWorkflowSchedule({ workflowId, status: "PAUSED", triggerType: "SCHEDULE", definition });
    expect(await getScheduleQueue().getJobScheduler(`workflow:${workflowId}`)).toBeNull();
  });

  it("dispatches a persisted run through the real BullMQ worker and records failure safely", async () => {
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

    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    workerProcess = spawn(npm, ["run", "worker"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "ignore",
      shell: process.platform === "win32",
    });

    const deadline = Date.now() + 20_000;
    let status = "QUEUED";
    while (Date.now() < deadline && status !== "FAILED") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await prisma.workflowRun.findUnique({ where: { id: run.id }, select: { status: true } });
      status = current?.status ?? "MISSING";
    }
    expect(status).toBe("FAILED");
  });
});
