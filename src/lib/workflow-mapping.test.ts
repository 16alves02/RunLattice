import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types";
import { getWorkflowMappingOptions } from "@/lib/workflow-mapping";

const nodes: WorkflowNode[] = [
  { id: "trigger", kind: "trigger", title: "Manual input", detail: "", x: 0, y: 0 },
  { id: "http-one", kind: "action", title: "Find customer", detail: "", config: { integrationId: "http", actionId: "request", method: "GET", url: "https://api.example.com/customer", responsePath: "data.id" }, x: 200, y: 0 },
  { id: "http-two", kind: "action", title: "Update customer", detail: "", config: { integrationId: "http", actionId: "request", method: "PATCH", url: "https://api.example.com/customer", responsePath: "data.id" }, x: 400, y: 0 },
  { id: "discord", kind: "action", title: "Notify", detail: "", config: { integrationId: "discord", actionId: "send_message", message: "done" }, x: 600, y: 0 },
];
const edges: WorkflowEdge[] = [
  { id: "e1", from: "trigger", to: "http-one" },
  { id: "e2", from: "http-one", to: "http-two" },
  { id: "e3", from: "http-two", to: "discord" },
];

describe("workflow data mapping options", () => {
  it("offers known trigger input paths and response values from upstream HTTP actions", () => {
    const options = getWorkflowMappingOptions(nodes, edges, "discord");
    expect(options.map((option) => option.path)).toContain("customer.email");
    expect(options.map((option) => option.path)).toContain("steps.http-one.responseValue");
    expect(options.map((option) => option.path)).toContain("steps.http-two.responseValue");
  });

  it("does not offer values from downstream or disconnected steps", () => {
    const options = getWorkflowMappingOptions(nodes, edges.slice(0, 1), "http-one");
    expect(options.map((option) => option.path)).not.toContain("steps.http-two.responseValue");
    expect(options.map((option) => option.path)).not.toContain("steps.http-one.responseValue");
  });

  it("does not offer an HTTP output unless a response path is configured", () => {
    const withoutResponse = nodes.map((node) => node.id === "http-one"
      ? { ...node, config: { integrationId: "http" as const, actionId: "request" as const, method: "GET" as const, url: "https://api.example.com/customer" } }
      : node);
    const options = getWorkflowMappingOptions(withoutResponse, edges, "discord");
    expect(options.map((option) => option.path)).not.toContain("steps.http-one.responseValue");
  });
});
