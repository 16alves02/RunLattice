import { describe, expect, it } from "vitest";
import type { WorkflowNode } from "@/lib/types";
import { connectWorkflowNodes, getWorkflowCanvasSize, moveWorkflowNode } from "@/lib/workflow-graph";

const nodes: WorkflowNode[] = [
  { id: "trigger", kind: "trigger", title: "Start", detail: "", x: 20, y: 30 },
  { id: "action-a", kind: "action", title: "Action A", detail: "", x: 300, y: 30 },
  { id: "action-b", kind: "action", title: "Action B", detail: "", x: 600, y: 30 },
  { id: "condition", kind: "condition", title: "Condition", detail: "", config: { path: "input.ok", operator: "exists" }, x: 20, y: 180 },
];

describe("workflow graph editing helpers", () => {
  it("creates a valid connection between existing nodes", () => {
    const result = connectWorkflowNodes(nodes, [], "trigger", "action-a");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.edges).toMatchObject([{ from: "trigger", to: "action-a" }]);
  });

  it("requires explicit branches for condition nodes", () => {
    expect(connectWorkflowNodes(nodes, [], "condition", "action-a")).toMatchObject({ ok: false });
    const result = connectWorkflowNodes(nodes, [], "condition", "action-a", "true");
    expect(result.ok).toBe(true);
  });

  it("prevents duplicate and excess outgoing connections", () => {
    const first = connectWorkflowNodes(nodes, [], "trigger", "action-a");
    if (!first.ok) throw new Error(first.error);
    expect(connectWorkflowNodes(nodes, first.edges, "trigger", "action-b")).toMatchObject({ ok: false });
    expect(connectWorkflowNodes(nodes, first.edges, "trigger", "action-a")).toMatchObject({ ok: false });
  });

  it("prevents graph cycles", () => {
    const first = connectWorkflowNodes(nodes, [], "trigger", "action-a");
    if (!first.ok) throw new Error(first.error);
    const second = connectWorkflowNodes(nodes, first.edges, "action-a", "action-b");
    if (!second.ok) throw new Error(second.error);
    expect(connectWorkflowNodes(nodes, second.edges, "action-b", "trigger")).toMatchObject({
      ok: false,
      error: "This connection would create a cycle.",
    });
  });

  it("moves nodes while keeping positions inside the supported canvas range", () => {
    expect(moveWorkflowNode(nodes, "action-a", 345.7, -50)[1]).toMatchObject({ x: 346, y: 0 });
  });

  it("expands the canvas to include moved nodes", () => {
    expect(getWorkflowCanvasSize([{ ...nodes[0], x: 1_200, y: 900 }])).toEqual({ width: 1_460, height: 1_080 });
  });
});
