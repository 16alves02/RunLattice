import { describe, expect, it } from "vitest";
import { resolveExecutionPath } from "@/lib/execution";
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
