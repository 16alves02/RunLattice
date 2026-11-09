import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowSchema } from "@/lib/validation";
import { inferTriggerType } from "@/lib/trigger-type";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { readBoundedJsonRequest } from "@/lib/read-bounded-body";

export async function GET(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;

  try {
    const workflows = await prisma.workflow.findMany({
      where: { organizationId: access.context.organizationId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { runs: true } } },
    });
    return NextResponse.json({
      data: workflows.map(({ _count, ...workflow }) => ({ ...workflow, runs: _count.runs })),
    });
  } catch (error) {
    console.error("Unable to list workflows:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const bodyResult = await readBoundedJsonRequest(request, 262_144);
  if (!bodyResult.ok) return NextResponse.json({ error: "Invalid or oversized workflow request." }, { status: bodyResult.reason === "too_large" ? 413 : 400 });
  const parsed = createWorkflowSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Invalid workflow data.",
      issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    }, { status: 400 });
  }

  try {
    const workflow = await prisma.workflow.create({
      data: {
        userId: access.context.userId,
        organizationId: access.context.organizationId,
        name: parsed.data.name,
        description: parsed.data.description,
        definition: parsed.data.definition,
        triggerType: inferTriggerType(parsed.data.definition),
      },
    });
    return NextResponse.json({ data: workflow }, { status: 201 });
  } catch (error) {
    console.error("Unable to create workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow could not be saved." }, { status: 503 });
  }
}
