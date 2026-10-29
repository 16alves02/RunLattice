import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema, createWorkflowSchema } from "@/lib/validation";

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
