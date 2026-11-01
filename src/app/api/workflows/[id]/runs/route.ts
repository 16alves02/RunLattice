import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkflowQueue } from "@/lib/queue";
import { getCurrentUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;

  try {
    const workflow = await prisma.workflow.findFirst({ where: { id, userId: user.id } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (workflow.status !== "ACTIVE") return NextResponse.json({ error: "Only active workflows can be run." }, { status: 409 });

    const run = await prisma.workflowRun.create({ data: { workflowId: workflow.id, input: {} } });
    try {
      await getWorkflowQueue().add("execute-workflow", { runId: run.id, workflowId: workflow.id }, { jobId: run.id, attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 500, removeOnFail: 1000 });
    } catch (queueError) {
      await prisma.workflowRun.update({ where: { id: run.id }, data: { status: "FAILED", error: "The execution queue is unavailable.", finishedAt: new Date() } });
      throw queueError;
    }
    return NextResponse.json({ data: run }, { status: 202 });
  } catch (error) {
    console.error("Unable to queue workflow run:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow run could not be queued. Check Redis and database configuration." }, { status: 503 });
  }
}
