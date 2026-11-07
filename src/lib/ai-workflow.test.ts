import { describe, expect, it } from "vitest";
import { aiWorkflowPlanSchema, aiWorkflowRequestSchema, buildWorkflowPrompt } from "@/lib/ai-workflow";

const validPlan = {
  name: "Order notification",
  description: "Prepare a customer notification when an order arrives.",
  definition: {
    nodes: [
      { id: "start", kind: "trigger", title: "New order", detail: "Trigger · Shopify webhook", x: 0, y: 0 },
      { id: "email", kind: "action", title: "Prepare email", detail: "Action · Gmail", x: 280, y: 0 },
    ],
    edges: [{ id: "edge-1", from: "start", to: "email" }],
  },
};

describe("AI workflow planning validation", () => {
  it("accepts a useful natural-language request", () => {
    expect(aiWorkflowRequestSchema.safeParse({ prompt: "Send an email when a new order arrives." }).success).toBe(true);
  });

  it("rejects prompts that are too short", () => {
    expect(aiWorkflowRequestSchema.safeParse({ prompt: "Do it" }).success).toBe(false);
  });

  it("accepts a valid workflow draft", () => {
    expect(aiWorkflowPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects a generated graph with a missing connection target", () => {
    const invalid = { ...validPlan, definition: { ...validPlan.definition, edges: [{ id: "edge-1", from: "start", to: "missing" }] } };
    expect(aiWorkflowPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("limits AI planning to the integration catalog", () => {
    const prompt = buildWorkflowPrompt("Notify me about orders", ["Shopify", "Gmail"]);
    expect(prompt).toContain("Shopify, Gmail");
    expect(prompt).toContain("Do not generate code, secrets");
  });
});
