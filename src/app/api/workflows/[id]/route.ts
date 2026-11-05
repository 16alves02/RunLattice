import { NextResponse } from "next/server";
import { WorkflowStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowDefinitionSchema } from "@/lib/validation";
import { validateExecutableWorkflow } from "@/lib/execution";
import type { WorkflowDefinition } from "@/lib/types";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;

  const { id } = await context.params;
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id, organizationId: access.context.organizationId },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    return NextResponse.json({ data: workflow });
  } catch (error) {
    console.error("Unable to retrieve workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow service is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const data: Prisma.WorkflowUpdateManyMutationInput = {};

  if ("name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) {
      return NextResponse.json({ error: "Name must contain between 2 and 80 characters." }, { status: 400 });
    }
    data.name = input.name.trim();
  }
  if ("description" in input) {
    if (typeof input.description !== "string" || input.description.length > 300) {
      return NextResponse.json({ error: "Description must be 300 characters or fewer." }, { status: 400 });
    }
    data.description = input.description.trim();
  }
  if ("status" in input) {
    if (typeof input.status !== "string" || !Object.values(WorkflowStatus).includes(input.status as WorkflowStatus)) {
      return NextResponse.json({ error: "Invalid workflow status." }, { status: 400 });
    }
    data.status = input.status as WorkflowStatus;
  }
  if ("definition" in input) {
    const definition = workflowDefinitionSchema.safeParse(input.definition);
    if (!definition.success) {
      return NextResponse.json({ error: "Invalid workflow definition.", issues: definition.error.issues }, { status: 400 });
    }
    data.definition = definition.data as Prisma.InputJsonValue;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No supported fields were provided." }, { status: 400 });
  }

  try {
    const existing = await prisma.workflow.findFirst({
      where: { id, organizationId: access.context.organizationId },
      select: { status: true, definition: true },
    });
    if (!existing) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });

    const nextStatus = typeof input.status === "string" ? input.status : existing.status;
    if (nextStatus === "ACTIVE") {
      const candidateDefinition = "definition" in input ? input.definition : existing.definition;
      const parsedDefinition = workflowDefinitionSchema.safeParse(candidateDefinition);
      if (!parsedDefinition.success) {
        return NextResponse.json({ error: "The workflow definition is invalid.", issues: parsedDefinition.error.issues }, { status: 400 });
      }
      let executablePath: WorkflowDefinition["nodes"];
      try {
        executablePath = validateExecutableWorkflow(parsedDefinition.data as WorkflowDefinition);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "The workflow cannot be activated." }, { status: 400 });
      }

      const connectionIds = [...new Set(executablePath
        .filter((node) => node.kind === "action")
        .map((node) => node.config && "integrationId" in node.config ? node.config.connectionId : undefined)
        .filter((connectionId): connectionId is string => Boolean(connectionId)))];
      if (connectionIds.length > 0) {
        let availableConnections = 0;
        try {
          availableConnections = await prisma.integrationConnection.count({
            where: {
              id: { in: connectionIds },
              organizationId: access.context.organizationId,
              provider: "discord",
            },
          });
        } catch {
          return NextResponse.json({ error: "Integration connections could not be verified." }, { status: 503 });
        }
        if (availableConnections !== connectionIds.length) {
          return NextResponse.json({ error: "One or more workflow actions reference a connection outside this workspace or a connection that no longer exists." }, { status: 400 });
        }
      }
    }

    const result = await prisma.workflow.updateMany({
      where: { id, organizationId: access.context.organizationId },
      data,
    });
    if (result.count === 0) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });

    const workflow = await prisma.workflow.findFirst({
      where: { id, organizationId: access.context.organizationId },
    });
    return NextResponse.json({ data: workflow });
  } catch (error) {
    console.error("Unable to update workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow could not be updated." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const result = await prisma.workflow.deleteMany({
      where: { id, organizationId: access.context.organizationId },
    });
    if (result.count === 0) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow could not be deleted." }, { status: 503 });
  }
}
