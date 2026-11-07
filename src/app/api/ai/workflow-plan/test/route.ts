import { NextResponse } from "next/server";
import { aiWorkflowDryRunRequestSchema, simulateAIWorkflow } from "@/lib/ai-dry-run";
import { getRequestWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
    return NextResponse.json({ error: "Workflow simulations must be 64 KB or smaller." }, { status: 413 });
  }
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 }); }
  const parsed = aiWorkflowDryRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "The workflow cannot be simulated because its definition or input is invalid.",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    }, { status: 400 });
  }

  try {
    const result = simulateAIWorkflow(parsed.data.definition, parsed.data.input ?? {});
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The workflow could not be simulated.",
    }, { status: 422 });
  }
}
