import { describe, expect, it } from "vitest";
import { resolveExecutionPath, validateExecutableWorkflow } from "@/lib/execution";
import type { WorkflowDefinition } from "@/lib/types";

const definition: WorkflowDefinition = {
  nodes: [
    { id: "trigger", kind: "trigger", title: "Manual start", detail: "", x: 0, y: 0 },
    { id: "action-1", kind: "action", title: "Send message", detail: "", x: 100, y: 0 },
    { id: "action-2", kind: "action", title: "Send follow-up", detail: "", x: 200, y: 0 },
  ],
  edges: [
    { id: "edge-1", from: "trigger", to: "action-1" },
    { id: "edge-2", from: "action-1", to: "action-2" },
  ],
};

describe("workflow execution path", () => {
  it("resolves a connected linear path in execution order", () => {
    expect(resolveExecutionPath(definition).map((node) => node.id))
      .toEqual(["trigger", "action-1", "action-2"]);
  });

  it("rejects workflows without exactly one trigger", () => {
    expect(() => resolveExecutionPath({ ...definition, nodes: definition.nodes.slice(1) }))
      .toThrow(/exactly one trigger/);
  });

  it("rejects branching paths", () => {
    const branching: WorkflowDefinition = {
      ...definition,
      edges: [
        { id: "edge-1", from: "trigger", to: "action-1" },
        { id: "edge-2", from: "trigger", to: "action-2" },
      ],
    };
    expect(() => resolveExecutionPath(branching)).toThrow(/Branching/);
  });

  it("rejects disconnected nodes", () => {
    expect(() => resolveExecutionPath({ ...definition, edges: definition.edges.slice(0, 1) }))
      .toThrow(/Every workflow node/);
  });

  it("rejects cycles", () => {
    const cyclic: WorkflowDefinition = {
      nodes: definition.nodes.slice(0, 2),
      edges: [
        { id: "edge-1", from: "trigger", to: "action-1" },
        { id: "edge-2", from: "action-1", to: "trigger" },
      ],
    };
    expect(() => resolveExecutionPath(cyclic)).toThrow(/cycle/);
  });
});


describe("workflow activation validation", () => {
  it("rejects action nodes without a connection and message", () => {
    expect(() => validateExecutableWorkflow(definition)).toThrow(/requires a connected integration/);
  });

  it("rejects condition nodes until condition evaluation is implemented", () => {
    const withCondition: WorkflowDefinition = {
      nodes: [
        definition.nodes[0],
        { id: "condition", kind: "condition", title: "Check value", detail: "", x: 50, y: 50 },
      ],
      edges: [{ id: "edge", from: "trigger", to: "condition" }],
    };
    expect(() => validateExecutableWorkflow(withCondition)).toThrow(/Condition nodes are not available/);
  });

  it("accepts a configured Discord action", () => {
    const configured: WorkflowDefinition = {
      nodes: [
        definition.nodes[0],
        {
          ...definition.nodes[1],
          config: {
            integrationId: "discord",
            actionId: "send_message",
            connectionId: "connection-1",
            message: "Workflow completed.",
          },
        },
      ],
      edges: [{ id: "edge", from: "trigger", to: "action-1" }],
    };
    expect(validateExecutableWorkflow(configured).map((node) => node.id)).toEqual(["trigger", "action-1"]);
  });
});
