import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;

  try {
    const runs = await prisma.workflowRun.findMany({
      where: { workflow: { organizationId: access.context.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { workflow: { select: { name: true } } },
    });
    return NextResponse.json({
      data: runs.map((run) => ({
        id: run.id,
        workflow: run.workflow.name,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        error: run.error,
        executionMode: run.output && typeof run.output === "object" && !Array.isArray(run.output) && "executionMode" in run.output
          ? run.output.executionMode
          : null,
      })),
    });
  } catch (error) {
    console.error("Unable to list recent runs:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Execution history is unavailable." }, { status: 503 });
  }
}
