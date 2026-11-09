import { describe, expect, it } from "vitest";
import { resolveExecutionPath, resolveNextExecutionNode, validateExecutableWorkflow } from "@/lib/execution";
import type { WorkflowDefinition } from "@/lib/types";

const actionConfig = {
  integrationId: "discord" as const,
  actionId: "send_message" as const,
  connectionId: "connection-1",
  message: "Workflow completed.",
};

const definition: WorkflowDefinition = {
  nodes: [
    { id: "trigger", kind: "trigger", title: "Manual start", detail: "", x: 0, y: 0 },
    { id: "action-1", kind: "action", title: "Send message", detail: "", config: actionConfig, x: 100, y: 0 },
    { id: "action-2", kind: "action", title: "Send follow-up", detail: "", config: actionConfig, x: 200, y: 0 },
  ],
  edges: [
    { id: "edge-1", from: "trigger", to: "action-1" },
    { id: "edge-2", from: "action-1", to: "action-2" },
  ],
};

const conditionalDefinition: WorkflowDefinition = {
  nodes: [
    definition.nodes[0],
    {
      id: "condition",
      kind: "condition",
      title: "Check score",
      detail: "",
      config: { path: "customer.score", operator: "greater_than", value: 50 },
      x: 100,
      y: 0,
    },
    { id: "true-action", kind: "action", title: "High score", detail: "", config: actionConfig, x: 300, y: -80 },
    { id: "false-action", kind: "action", title: "Low score", detail: "", config: actionConfig, x: 300, y: 80 },
  ],
  edges: [
    { id: "start-condition", from: "trigger", to: "condition" },
    { id: "true-edge", from: "condition", to: "true-action", branch: "true" },
    { id: "false-edge", from: "condition", to: "false-action", branch: "false" },
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
    expect(() => resolveExecutionPath(cyclic)).toThrow(/incoming connection/);
  });

  it("follows the true branch when the condition matches", () => {
    expect(resolveExecutionPath(conditionalDefinition, { customer: { score: 80 } }).map((node) => node.id))
      .toEqual(["trigger", "condition", "true-action"]);
  });

  it("follows the false branch when the condition does not match", () => {
    expect(resolveExecutionPath(conditionalDefinition, { customer: { score: 20 } }).map((node) => node.id))
      .toEqual(["trigger", "condition", "false-action"]);
  });

  it("routes a condition using a mapped response from a completed HTTP action", () => {
    const responseDefinition: WorkflowDefinition = {
      nodes: [
        definition.nodes[0],
        {
          id: "http_action",
          kind: "action",
          title: "Get invoice",
          detail: "",
          config: {
            integrationId: "http",
            actionId: "request",
            connectionId: "http-connection",
            method: "GET",
            url: "https://api.example.com/invoices",
            responsePath: "data.amount",
          },
          x: 100,
          y: 0,
        },
        {
          id: "condition",
          kind: "condition",
          title: "Check invoice amount",
          detail: "",
          config: { path: "steps.http_action.responseValue", operator: "greater_than", value: 100 },
          x: 200,
          y: 0,
        },
        { id: "true-action", kind: "action", title: "High value", detail: "", config: actionConfig, x: 300, y: -80 },
        { id: "false-action", kind: "action", title: "Low value", detail: "", config: actionConfig, x: 300, y: 80 },
      ],
      edges: [
        { id: "start-http", from: "trigger", to: "http_action" },
        { id: "http-condition", from: "http_action", to: "condition" },
        { id: "condition-true", from: "condition", to: "true-action", branch: "true" },
        { id: "condition-false", from: "condition", to: "false-action", branch: "false" },
      ],
    };
    const trigger = responseDefinition.nodes[0];
    const httpAction = resolveNextExecutionNode(responseDefinition, trigger);
    expect(httpAction?.id).toBe("http_action");
    const condition = resolveNextExecutionNode(responseDefinition, httpAction!, {
      steps: { http_action: { httpStatus: 200, responseValue: 150 } },
    });
    expect(condition?.id).toBe("condition");
    const selected = resolveNextExecutionNode(responseDefinition, condition!, {
      steps: { http_action: { httpStatus: 200, responseValue: 150 } },
    });
    expect(selected?.id).toBe("true-action");
  });

  it("rejects a condition without both branch connections", () => {
    const incomplete = { ...conditionalDefinition, edges: conditionalDefinition.edges.slice(0, 2) };
    expect(() => resolveExecutionPath(incomplete)).toThrow(/exactly one true and one false/);
  });
});

describe("workflow activation validation", () => {
  it("rejects a trigger-only workflow", () => {
    const triggerOnly: WorkflowDefinition = { nodes: [definition.nodes[0]], edges: [] };
    expect(() => validateExecutableWorkflow(triggerOnly)).toThrow(/at least one configured action/);
  });

  it("accepts a configured Discord action", () => {
    expect(validateExecutableWorkflow(definition).map((node) => node.id))
      .toEqual(["trigger", "action-1", "action-2"]);
  });

  it("validates actions on both condition branches before activation", () => {
    const incomplete = {
      ...conditionalDefinition,
      nodes: conditionalDefinition.nodes.map((node) => node.id === "false-action" ? { ...node, config: undefined } : node),
    };
    expect(() => validateExecutableWorkflow(incomplete)).toThrow(/requires a connected integration/);
  });

  it("accepts a configured conditional workflow", () => {
    expect(validateExecutableWorkflow(conditionalDefinition).map((node) => node.id))
      .toEqual(["trigger", "condition", "true-action", "false-action"]);
  });
});
