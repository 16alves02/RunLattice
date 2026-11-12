import { describe, expect, it } from "vitest";
import { buildExecutionTrace, formatExecutionData, redactExecutionData } from "@/lib/execution-inspector";
import type { WorkflowDefinition } from "@/lib/types";

describe("execution inspector data redaction", () => {
  it("redacts sensitive object fields recursively", () => {
    expect(redactExecutionData({
      message: "sent",
      credentials: { apiKey: "private-key" },
      nested: [{ access_token: "private-token", value: 42 }],
    })).toEqual({
      message: "sent",
      credentials: "[REDACTED]",
      nested: [{ access_token: "[REDACTED]", value: 42 }],
    });
  });

  it("redacts bearer credentials embedded in strings", () => {
    expect(formatExecutionData({ header: "Bearer abc.def.ghi" })).toContain("Bearer [REDACTED]");
    expect(formatExecutionData({ header: "Bearer abc.def.ghi" })).not.toContain("abc.def.ghi");
  });

  it("truncates oversized execution data", () => {
    const formatted = formatExecutionData({ payload: "x".repeat(100) }, 30);
    expect(formatted.length).toBeLessThan(100);
    expect(formatted).toContain("Output truncated");
  });
});


describe("execution inspector trace", () => {
  const definition: WorkflowDefinition = {
    nodes: [
      { id: "trigger", kind: "trigger", title: "Webhook", detail: "Incoming webhook", x: 0, y: 0 },
      { id: "condition", kind: "condition", title: "Paid?", detail: "Check payment", x: 200, y: 0, config: { path: "payment.status", operator: "equals", value: "paid" } },
      { id: "paid", kind: "action", title: "Paid alert", detail: "Discord · paid branch", x: 400, y: 0 },
      { id: "unpaid", kind: "action", title: "Unpaid alert", detail: "Discord · unpaid branch", x: 400, y: 200 },
    ],
    edges: [
      { id: "a", from: "trigger", to: "condition" },
      { id: "b", from: "condition", to: "paid", branch: "true" },
      { id: "c", from: "condition", to: "unpaid", branch: "false" },
    ],
  };

  it("shows the condition decision and identifies the branch actually entered", () => {
    const trace = buildExecutionTrace(definition, [
      { id: "1", nodeId: "trigger", title: "Webhook", kind: "trigger", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: {}, error: null },
      { id: "2", nodeId: "condition", title: "Paid?", kind: "condition", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: { condition: true }, error: null },
      { id: "3", nodeId: "paid", title: "Paid alert", kind: "action", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: {}, error: null },
    ]);
    expect(trace[1].decision).toBe("true");
    expect(trace[2].enteredThroughBranch).toBe("true");
    expect(trace[2].detail).toBe("Discord · paid branch");
  });

  it("does not label a branch unless it matches the recorded condition and actual next node", () => {
    const trace = buildExecutionTrace(definition, [
      { id: "1", nodeId: "condition", title: "Paid?", kind: "condition", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: { condition: true }, error: null },
      { id: "2", nodeId: "unpaid", title: "Unpaid alert", kind: "action", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: {}, error: null },
    ]);
    expect(trace[1].enteredThroughBranch).toBeUndefined();
  });

  it("does not fabricate details for nodes absent from the saved definition", () => {
    const trace = buildExecutionTrace(undefined, [
      { id: "1", nodeId: "old-node", title: "Legacy step", kind: "action", attempt: 1, status: "SUCCEEDED", startedAt: null, finishedAt: null, result: {}, error: null },
    ]);
    expect(trace[0].detail).toBeUndefined();
    expect(trace).toHaveLength(1);
  });
});
