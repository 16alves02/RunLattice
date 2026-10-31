import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowSchema } from "@/lib/validation";
import { inferTriggerType } from "@/lib/trigger-type";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const workflows = await prisma.workflow.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { runs: true } } },
    });
    return NextResponse.json({ data: workflows.map(({ _count, ...workflow }) => ({ ...workflow, runs: _count.runs })) });
  } catch (error) {
    console.error("Unable to list workflows:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The workflow service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow data.", issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 400 });
  }

  try {
    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
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
