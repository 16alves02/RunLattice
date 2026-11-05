import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema, createWorkflowSchema, createIntegrationConnectionSchema } from "@/lib/validation";

const validDefinition = {
  nodes: [
    { id: "trigger", kind: "trigger", title: "Start", detail: "Manual trigger", x: 0, y: 0 },
    { id: "action", kind: "action", title: "Send notification", detail: "Email adapter", x: 200, y: 0 },
  ],
  edges: [{ id: "edge-1", from: "trigger", to: "action" }],
};

describe("workflow definition validation", () => {
  it("accepts a valid graph", () => {
    expect(workflowDefinitionSchema.safeParse(validDefinition).success).toBe(true);
  });

  it("rejects connections to missing nodes", () => {
    const invalid = { ...validDefinition, edges: [{ id: "edge-1", from: "trigger", to: "missing" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate node identifiers", () => {
    const invalid = { ...validDefinition, nodes: [validDefinition.nodes[0], { ...validDefinition.nodes[1], id: "trigger" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a node connected to itself", () => {
    const invalid = { ...validDefinition, edges: [{ id: "edge-1", from: "trigger", to: "trigger" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates workflow names before persistence", () => {
    expect(createWorkflowSchema.safeParse({ name: "A", definition: validDefinition }).success).toBe(false);
    expect(createWorkflowSchema.safeParse({ name: "Lead capture", definition: validDefinition }).success).toBe(true);
  });
});


describe("Discord integration connection validation", () => {
  const validConnection = {
    provider: "discord",
    name: "Team alerts",
    webhookUrl: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789",
  };

  it("accepts a valid HTTPS Discord webhook", () => {
    expect(createIntegrationConnectionSchema.safeParse(validConnection).success).toBe(true);
  });

  it("rejects non-Discord hosts and insecure URLs", () => {
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: "https://example.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    }).success).toBe(false);
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: validConnection.webhookUrl.replace("https:", "http:"),
    }).success).toBe(false);
  });

  it("rejects URL query strings and fragments", () => {
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: `${validConnection.webhookUrl}?redirect=https://example.com`,
    }).success).toBe(false);
  });
});
