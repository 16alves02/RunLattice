import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkflowQueue } from "@/lib/queue";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { workflowRunInputSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  let input: Record<string, unknown> = {};
  try {
    const rawBody = await request.text();
    if (rawBody.length > 32_768) {
      return NextResponse.json({ error: "Workflow input must be 32 KB or smaller." }, { status: 413 });
    }
    if (rawBody.trim()) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ error: "Workflow input must be a JSON object." }, { status: 400 });
      }
      const parsedInput = workflowRunInputSchema.safeParse(body);
      if (!parsedInput.success) {
        return NextResponse.json({ error: "Invalid workflow input.", issues: parsedInput.error.issues }, { status: 400 });
      }
      input = parsedInput.data;
    }
  } catch {
    return NextResponse.json({ error: "The workflow input could not be read." }, { status: 400 });
  }

  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id, organizationId: access.context.organizationId },
    });
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (workflow.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only active workflows can be run." }, { status: 409 });
    }

    const run = await prisma.workflowRun.create({ data: { workflowId: workflow.id, input: input as Prisma.InputJsonValue } });
    try {
      await getWorkflowQueue().add(
        "execute-workflow",
        { runId: run.id, workflowId: workflow.id },
        {
          jobId: run.id,
          attempts: 1,
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      );
    } catch (queueError) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: "The execution queue is unavailable.", finishedAt: new Date() },
      });
      throw queueError;
    }
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (error) {
    console.error("Unable to queue workflow run:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow run could not be queued. Check Redis and database configuration." }, { status: 503 });
  }
}
