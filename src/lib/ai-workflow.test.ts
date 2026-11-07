import { describe, expect, it } from "vitest";
import {
  aiWorkflowPlanSchema,
  aiWorkflowRequestSchema,
  buildWorkflowPrompt,
  buildWorkflowSystemPrompt,
  findMissingIntegrations,
  findUnconfiguredActionTitles,
} from "@/lib/ai-workflow";
import { workflowDefinitionSchema } from "@/lib/validation";

const validPlan = {
  name: "Order notification",
  description: "Prepare a customer notification when an order arrives.",
  rationale: "The order event starts the process and the action prepares a notification.",
  assumptions: ["The store provides an order event."],
  requiredIntegrations: ["Shopify", "Gmail"],
  requiredPermissions: ["Read orders", "Send email after approval"],
  sideEffects: ["A customer email may be sent after the Gmail connection is configured."],
  definition: {
    nodes: [
      { id: "start", kind: "trigger", title: "New order", detail: "Trigger · Shopify webhook", x: 0, y: 0 },
      { id: "email", kind: "action", title: "Prepare email", detail: "Action · Gmail connection required", x: 280, y: 0 },
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

  it("accepts an explainable workflow proposal", () => {
    expect(aiWorkflowPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects a generated graph with a missing connection target", () => {
    const invalid = { ...validPlan, definition: { ...validPlan.definition, edges: [{ id: "edge-1", from: "start", to: "missing" }] } };
    expect(aiWorkflowPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("describes which integrations are connected and which are only planned", () => {
    const prompt = buildWorkflowPrompt("Notify me about orders", [
      { id: "discord", name: "Discord", status: "available", connected: true, actions: ["Send message"] },
      { id: "gmail", name: "Gmail", status: "planned", connected: false, actions: ["Send email"] },
    ]);
    expect(prompt).toContain('"connected":true');
    expect(prompt).toContain('"status":"planned"');
    expect(prompt).toContain("Do not invent a working adapter");
  });


  it("flags catalog-only, disconnected and unknown integrations", () => {
    const missing = findMissingIntegrations(["Discord", "Gmail", "Acme CRM"], [
      { id: "discord", name: "Discord", status: "available", connected: true, actions: ["Send message"] },
      { id: "gmail", name: "Gmail", status: "planned", connected: false, actions: ["Send email"] },
    ]);
    expect(missing).toEqual(["Gmail", "acme crm"]);
  });

  it("treats user prompts as untrusted data and blocks secret/code generation", () => {
    const systemPrompt = buildWorkflowSystemPrompt();
    expect(systemPrompt).toContain("untrusted data");
    expect(systemPrompt).toContain("Never generate executable code");
    expect(systemPrompt).toContain("Never reveal or request passwords");
  });


  it("requires action connections to belong to the current workspace and provider", async () => {
    const definition = workflowDefinitionSchema.parse({
      nodes: [
        { id: "trigger", kind: "trigger", title: "Manual", detail: "", x: 0, y: 0 },
        { id: "action", kind: "action", title: "Send message", detail: "", config: {
          integrationId: "discord", connectionId: "foreign-connection", message: "Hello",
        }, x: 250, y: 0 },
      ],
      edges: [{ id: "edge-1", from: "trigger", to: "action" }],
    });
    expect(findUnconfiguredActionTitles(definition, [
      { id: "workspace-discord", provider: "discord" },
    ])).toEqual(["Send message"]);
    expect(findUnconfiguredActionTitles(definition, [
      { id: "foreign-connection", provider: "gmail" },
    ])).toEqual(["Send message"]);
    expect(findUnconfiguredActionTitles(definition, [
      { id: "foreign-connection", provider: "discord" },
    ])).toEqual([]);
  });
});
