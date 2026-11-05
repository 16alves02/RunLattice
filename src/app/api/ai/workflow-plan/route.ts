import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aiWorkflowPlanSchema,
  aiWorkflowRequestSchema,
  findMissingIntegrations,
  type AIIntegrationContext,
  buildWorkflowPrompt,
  buildWorkflowSystemPrompt,
} from "@/lib/ai-workflow";
import { integrationCatalog } from "@/lib/integrations";
import { generateAICompletion, getAIProviderSelection } from "@/lib/ai-provider";
import {
  estimateReservedTokens,
  getAIUsageLimits,
  getUsagePeriodStart,
  releaseAIUsage,
  reserveAIUsage,
  settleAIUsage,
} from "@/lib/ai-usage";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required to use AI planning." }, { status: 403 });
  }

  if (process.env.AI_ASSISTANT_ENABLED !== "true") {
    return NextResponse.json({ error: "The AI assistant is not enabled on this deployment." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 10_000) {
    return NextResponse.json({ error: "AI planning requests must be 10 KB or smaller." }, { status: 413 });
  }
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 }); }
  const parsed = aiWorkflowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Describe the automation in at least 10 characters (maximum 2,000).",
    }, { status: 400 });
  }

  const selection = getAIProviderSelection();
  const limits = getAIUsageLimits();
  const reservedTokens = estimateReservedTokens(parsed.data.prompt);
  let reservation;
  try {
    reservation = await reserveAIUsage(prisma, {
      organizationId: access.context.organizationId,
      userId: access.context.userId,
      provider: selection.provider,
      model: selection.model || "unconfigured",
      reservedTokens,
      limits,
    });
  } catch (error) {
    console.error("Unable to reserve workspace AI usage:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "AI usage accounting is temporarily unavailable." }, { status: 503 });
  }

  if (!reservation) {
    return NextResponse.json({
      error: "This workspace has reached its monthly AI request or token budget.",
      limits,
    }, { status: 429 });
  }

  let generated;
  let integrationContext: AIIntegrationContext[] = [];
  try {
    const connections = await prisma.integrationConnection.findMany({
      where: { organizationId: access.context.organizationId },
      select: { provider: true },
    });
    const connectedProviders = new Set(connections.map((connection) => connection.provider));
    integrationContext = integrationCatalog.map((integration) => ({
      id: integration.id,
      name: integration.name,
      status: integration.status,
      connected: connectedProviders.has(integration.id),
      actions: integration.actions,
    }));

    generated = await generateAICompletion(
      buildWorkflowSystemPrompt(),
      buildWorkflowPrompt(parsed.data.prompt, integrationContext),
      { provider: selection.provider, model: selection.model || undefined, maxOutputTokens: 1_200 },
    );
  } catch (error) {
    await releaseAIUsage(prisma, reservation).catch((releaseError) => {
      console.error("Unable to release failed AI reservation:", releaseError instanceof Error ? releaseError.message : "Unknown error");
    });
    console.error("AI workflow planning failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The AI provider could not create a workflow plan. Check provider configuration and try again." }, { status: 502 });
  }

  try {
    await settleAIUsage(prisma, reservation, {
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
    });
  } catch (error) {
    console.error("Unable to settle workspace AI usage:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The plan was generated but usage accounting could not be completed. Please try again later." }, { status: 503 });
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(generated.content);
  } catch {
    return NextResponse.json({ error: "The AI provider returned an invalid plan. Please try again." }, { status: 502 });
  }

  const plan = aiWorkflowPlanSchema.safeParse(candidate);
  if (!plan.success) {
    return NextResponse.json({
      error: "The generated workflow did not pass validation. Please refine your request.",
      issues: plan.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    }, { status: 422 });
  }

  const required = new Set(plan.data.requiredIntegrations.map((name) => name.toLowerCase()));
  for (const node of plan.data.definition.nodes) {
    if (node.config && "integrationId" in node.config) required.add(node.config.integrationId);
  }
  const missingIntegrations = findMissingIntegrations([...required], integrationContext);

  const periodStart = getUsagePeriodStart();
  const usage = await prisma.aiWorkspaceUsage.findUnique({
    where: {
      organizationId_periodStart: {
        organizationId: access.context.organizationId,
        periodStart,
      },
    },
    select: { requestsUsed: true, tokensUsed: true },
  });

  return NextResponse.json({
    data: {
      ...plan.data,
      missingIntegrations,
      executionReadiness: missingIntegrations.length === 0 ? "review_required" : "setup_required",
    },
    requiresReview: true,
    saved: false,
    usage: {
      requestsUsed: usage?.requestsUsed ?? 0,
      tokensUsed: usage?.tokensUsed ?? 0,
      monthlyRequestLimit: limits.monthlyRequests,
      monthlyTokenLimit: limits.monthlyTokens,
      provider: generated.provider,
      model: generated.model,
      tokensThisRequest: generated.promptTokens + generated.completionTokens,
    },
  });
}

