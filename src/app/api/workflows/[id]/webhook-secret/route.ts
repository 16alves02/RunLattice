import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id, organizationId: access.context.organizationId },
      select: { id: true, triggerType: true },
    });
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (workflow.triggerType !== "WEBHOOK") {
      return NextResponse.json({ error: "Change the workflow trigger to Webhook and save it first." }, { status: 409 });
    }

    const secret = randomBytes(32).toString("base64url");
    const ciphertext = encryptSecret(secret, `${access.context.organizationId}:workflow-webhook:${id}`);
    await prisma.workflow.updateMany({
      where: { id, organizationId: access.context.organizationId },
      data: { webhookSecretCiphertext: ciphertext },
    });

    return NextResponse.json({
      data: {
        secret,
        endpoint: `/api/webhooks/${encodeURIComponent(id)}`,
        signature: "HMAC-SHA256(secret, timestamp + '.' + rawRequestBody), sent as x-runlattice-signature: v1=<hex>",
        timestampHeader: "x-runlattice-timestamp (Unix seconds; maximum clock skew 5 minutes)",
      },
    });
  } catch (error) {
    console.error("Unable to rotate workflow webhook secret:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The webhook secret could not be generated." }, { status: 503 });
  }
}
