import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { readBoundedJsonRequest } from "@/lib/read-bounded-body";

export const runtime = "nodejs";

const providerSchema = z.enum(["openai", "anthropic", "google"]);
const saveSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(12).max(500),
});

export async function GET(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace owner or administrator permission required." }, { status: 403 });
  }

  const credentials = await prisma.aIProviderCredential.findMany({
    where: { organizationId: access.context.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { provider: true, model: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ data: credentials });
}

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace owner or administrator permission required." }, { status: 403 });
  }

  const bodyResult = await readBoundedJsonRequest(request, 8_192);
  if (!bodyResult.ok) return NextResponse.json({ error: "Invalid or oversized request body." }, { status: bodyResult.reason === "too_large" ? 413 : 400 });
  const parsed = saveSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: "Provide a supported provider, model and valid API key." }, { status: 400 });

  try {
    const secretCiphertext = encryptSecret(
      parsed.data.apiKey,
      `${access.context.organizationId}:ai-provider:${parsed.data.provider}`,
    );
    const credential = await prisma.aIProviderCredential.upsert({
      where: {
        organizationId_provider: {
          organizationId: access.context.organizationId,
          provider: parsed.data.provider,
        },
      },
      create: {
        organizationId: access.context.organizationId,
        provider: parsed.data.provider,
        model: parsed.data.model,
        secretCiphertext,
      },
      update: { model: parsed.data.model, secretCiphertext },
      select: { provider: true, model: true, updatedAt: true },
    });
    return NextResponse.json({ data: credential }, { status: 200 });
  } catch (error) {
    console.error("Unable to save workspace AI credentials:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The AI provider key could not be stored securely." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace owner or administrator permission required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = z.object({ provider: providerSchema }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Select a supported AI provider." }, { status: 400 });

  await prisma.aIProviderCredential.deleteMany({
    where: {
      organizationId: access.context.organizationId,
      provider: parsed.data.provider,
    },
  });
  return NextResponse.json({ success: true });
}
