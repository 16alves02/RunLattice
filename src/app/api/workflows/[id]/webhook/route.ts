import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { encryptSecret } from "@/lib/secrets";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  const workflow = await prisma.workflow.findFirst({
    where: { id, organizationId: access.context.organizationId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  if (workflow.status !== "ACTIVE") {
    return NextResponse.json({ error: "Activate the workflow before enabling its webhook." }, { status: 409 });
  }

  const secret = randomBytes(32).toString("base64url");
  const ciphertext = encryptSecret(secret, `${workflow.organizationId}:workflow:${workflow.id}:webhook`);
  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { webhookSecretCiphertext: ciphertext, webhookEnabled: true, triggerType: "WEBHOOK" },
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  return NextResponse.json({
    data: {
      enabled: true,
      url: `${baseUrl.replace(/\/$/, "")}/api/webhooks/${workflow.id}`,
      secret,
      signature: "HMAC-SHA256",
      headers: {
        "X-RunLattice-Timestamp": "Unix timestamp in seconds",
        "X-RunLattice-Event-Id": "Unique event identifier",
        "X-RunLattice-Signature": "sha256=<hex HMAC of timestamp.raw-body>",
      },
      warning: "Copy this secret now. It is shown only once; rotate it to replace it.",
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }
  const { id } = await context.params;
  const result = await prisma.workflow.updateMany({
    where: { id, organizationId: access.context.organizationId },
    data: { webhookEnabled: false, webhookSecretCiphertext: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  return NextResponse.json({ data: { enabled: false } });
}
