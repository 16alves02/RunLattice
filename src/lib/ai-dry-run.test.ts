import { describe, expect, it } from "vitest";
import { simulateAIWorkflow } from "@/lib/ai-dry-run";

const definition = {
  nodes: [
    { id: "start", kind: "trigger" as const, title: "Manual trigger", detail: "", x: 0, y: 0 },
    { id: "condition", kind: "condition" as const, title: "Score check", detail: "", config: { path: "score", operator: "greater_than" as const, value: 50 }, x: 200, y: 0 },
    { id: "yes", kind: "action" as const, title: "Notify", detail: "Discord not invoked", x: 400, y: 0 },
    { id: "no", kind: "action" as const, title: "Skip", detail: "No external action", x: 400, y: 200 },
  ],
  edges: [
    { id: "a", from: "start", to: "condition" },
    { id: "b", from: "condition", to: "yes", branch: "true" as const },
    { id: "c", from: "condition", to: "no", branch: "false" as const },
  ],
};

describe("AI workflow dry run", () => {
  it("simulates only the selected path without invoking actions", () => {
    const result = simulateAIWorkflow(definition, { score: 80 });
    expect(result.selectedPath.map((step) => step.nodeId)).toEqual(["start", "condition", "yes"]);
    expect(result.simulationOnly).toBe(true);
    expect(result.externalSideEffectPerformed).toBe(false);
    expect(result.selectedPath[2].outcome).toBe("WOULD_RUN");
  });

  it("simulates the false branch without invoking actions", () => {
    const result = simulateAIWorkflow(definition, { score: 10 });
    expect(result.selectedPath.map((step) => step.nodeId)).toEqual(["start", "condition", "no"]);
    expect(result.externalSideEffectPerformed).toBe(false);
  });
});
