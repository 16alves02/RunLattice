import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const runs = await prisma.workflowRun.findMany({
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
      })),
    });
  } catch (error) {
    console.error("Unable to list recent runs:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Execution history is unavailable." }, { status: 503 });
  }
}
