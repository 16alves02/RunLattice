import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { encryptSecret } from "@/lib/secrets";
import { createIntegrationConnectionSchema } from "@/lib/validation";
import { integrationCatalog } from "@/lib/integrations";

export async function GET(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;

  try {
    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId: access.context.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, provider: true, name: true, createdAt: true },
    });

    return NextResponse.json({
      data: integrationCatalog,
      connections,
      connectedCount: connections.length,
      canManage: canManageWorkspace(access.context.role),
    });
  } catch (error) {
    console.error("Unable to list integration connections:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The integration service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createIntegrationConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Invalid integration connection.",
      issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    }, { status: 400 });
  }

  try {
    const connection = await prisma.integrationConnection.create({
      data: {
        organizationId: access.context.organizationId,
        provider: parsed.data.provider,
        name: parsed.data.name,
        credentialsCiphertext: encryptSecret(JSON.stringify({ webhookUrl: parsed.data.webhookUrl })),
      },
      select: { id: true, provider: true, name: true, createdAt: true },
    });

    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    console.error("Unable to save integration connection.");
    return NextResponse.json({ error: "The integration connection could not be saved. Check the encryption key configuration." }, { status: 503 });
  }
}
