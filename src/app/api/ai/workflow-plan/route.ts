import { NextResponse } from "next/server";
import { aiWorkflowPlanSchema, aiWorkflowRequestSchema, buildWorkflowPrompt } from "@/lib/ai-workflow";
import { integrationCatalog } from "@/lib/integrations";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  // Keep this endpoint disabled on public deployments until authenticated workspace access exists.
  if (process.env.AI_ASSISTANT_ENABLED !== "true") {
    return NextResponse.json({ error: "The AI assistant is not enabled. Authentication and workspace permissions must be configured before enabling it publicly." }, { status: 503 });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI_API_KEY is not configured on the server." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = aiWorkflowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Describe the automation in at least 10 characters (maximum 2,000)." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return valid JSON only. Never include credentials, code or instructions to perform external side effects." },
          { role: "user", content: buildWorkflowPrompt(parsed.data.prompt, integrationCatalog.map((item) => item.name)) },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      console.error("AI provider request failed with status:", response.status);
      return NextResponse.json({ error: "The AI provider could not create a workflow plan." }, { status: 502 });
    }

    const result = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "The AI provider returned an empty plan." }, { status: 502 });

    let candidate: unknown;
    try {
      candidate = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "The AI provider returned an invalid plan. Please try again." }, { status: 502 });
    }

    const plan = aiWorkflowPlanSchema.safeParse(candidate);
    if (!plan.success) {
      return NextResponse.json({ error: "The generated workflow did not pass validation. Please refine your request." }, { status: 422 });
    }

    return NextResponse.json({ data: plan.data, requiresReview: true, saved: false });
  } catch (error) {
    console.error("AI workflow planning failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The AI assistant could not be reached. Please try again." }, { status: 502 });
  }
}
