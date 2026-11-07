import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import { verifyWebhookSignature } from "@/lib/webhook-signature";
import { workflowRunInputSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_768) {
    return NextResponse.json({ error: "Webhook payload must be 32 KB or smaller." }, { status: 413 });
  }

  const eventId = request.headers.get("x-runlattice-event-id");
  if (!eventId || eventId.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(eventId)) {
    return NextResponse.json({ error: "A valid X-RunLattice-Event-Id header is required." }, { status: 400 });
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Webhook body must be valid JSON." }, { status: 400 });
  }
  const parsed = workflowRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Webhook body must be a JSON object within the input limits." }, { status: 400 });
  }

  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { id: true, status: true, organizationId: true, webhookEnabled: true, webhookSecretCiphertext: true },
    });
    if (!workflow || !workflow.organizationId || !workflow.webhookEnabled || !workflow.webhookSecretCiphertext) {
      return NextResponse.json({ error: "Webhook not found or disabled." }, { status: 404 });
    }
    if (workflow.status !== "ACTIVE") {
      return NextResponse.json({ error: "Workflow is not active." }, { status: 409 });
    }

    const secret = decryptSecret(
      workflow.webhookSecretCiphertext,
      `${workflow.organizationId}:workflow:${workflow.id}:webhook`,
    );
    const rawSignature = request.headers.get("x-runlattice-signature");
    const valid = verifyWebhookSignature({
      secret,
      timestamp: request.headers.get("x-runlattice-timestamp"),
      signature: rawSignature,
      rawBody,
    });
    if (!valid) return NextResponse.json({ error: "Invalid or expired webhook signature." }, { status: 401 });

    const run = await prisma.$transaction(async (tx) => {
      await tx.webhookDelivery.create({ data: { workflowId: workflow.id, eventId } });
      return tx.workflowRun.create({
        data: {
          workflowId: workflow.id,
          input: parsed.data as Prisma.InputJsonValue,
          outboxEvent: { create: {} },
        },
        select: { id: true, status: true, createdAt: true },
      });
    });
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This webhook event has already been received." }, { status: 409 });
    }
    console.error("[webhook] Delivery rejected:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook delivery could not be processed." }, { status: 503 });
  }
}
