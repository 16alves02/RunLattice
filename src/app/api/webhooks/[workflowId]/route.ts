import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import { verifyWebhookSignature } from "@/lib/webhook-signature";
import { workflowRunInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ workflowId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { workflowId } = await context.params;
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Request body could not be read." }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, "utf8") > 32_768) {
    return NextResponse.json({ error: "Webhook payload must be 32 KB or smaller." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Webhook payload must be valid JSON." }, { status: 400 });
  }
  const parsed = workflowRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Webhook payload must be a JSON object of 32 KB or smaller." }, { status: 400 });
  }

  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, status: "ACTIVE", triggerType: "WEBHOOK" },
      select: { id: true, organizationId: true, webhookSecretCiphertext: true },
    });
    if (!workflow?.organizationId || !workflow.webhookSecretCiphertext) {
      return NextResponse.json({ error: "Webhook endpoint is unavailable." }, { status: 404 });
    }

    let secret: string;
    try {
      secret = decryptSecret(
        workflow.webhookSecretCiphertext,
        `${workflow.organizationId}:workflow-webhook:${workflow.id}`,
      );
    } catch {
      return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 503 });
    }

    const valid = verifyWebhookSignature({
      secret,
      timestamp: request.headers.get("x-runlattice-timestamp"),
      signature: request.headers.get("x-runlattice-signature"),
      rawBody,
    });
    if (!valid) return NextResponse.json({ error: "Invalid or expired webhook signature." }, { status: 401 });

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        input: parsed.data as Prisma.InputJsonValue,
        outboxEvent: { create: {} },
      },
      select: { id: true, status: true, createdAt: true },
    });
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (error) {
    console.error("Unable to accept signed workflow webhook:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The webhook could not be queued." }, { status: 503 });
  }
}
