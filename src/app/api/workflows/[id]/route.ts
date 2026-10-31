import { NextResponse } from "next/server";
import { WorkflowStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowDefinitionSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id }, include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    return NextResponse.json({ data: workflow });
  } catch (error) {
    console.error("Unable to retrieve workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow service is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const data: Prisma.WorkflowUpdateInput = {};
  if ("name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) return NextResponse.json({ error: "Name must contain between 2 and 80 characters." }, { status: 400 });
    data.name = input.name.trim();
  }
  if ("description" in input) {
    if (typeof input.description !== "string" || input.description.length > 300) return NextResponse.json({ error: "Description must be 300 characters or fewer." }, { status: 400 });
    data.description = input.description.trim();
  }
  if ("status" in input) {
    if (typeof input.status !== "string" || !Object.values(WorkflowStatus).includes(input.status as WorkflowStatus)) return NextResponse.json({ error: "Invalid workflow status." }, { status: 400 });
    data.status = input.status as WorkflowStatus;
  }
  if ("definition" in input) {
    const definition = workflowDefinitionSchema.safeParse(input.definition);
    if (!definition.success) return NextResponse.json({ error: "Invalid workflow definition.", issues: definition.error.issues }, { status: 400 });
    data.definition = definition.data as Prisma.InputJsonValue;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "No supported fields were provided." }, { status: 400 });

  try {
    const workflow = await prisma.workflow.update({ where: { id }, data });
    return NextResponse.json({ data: workflow });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    console.error("Unable to update workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow could not be updated." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.workflow.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    console.error("Unable to delete workflow:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow could not be deleted." }, { status: 503 });
  }
}
