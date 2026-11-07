import { describe, expect, it } from "vitest";
import { inferTriggerType } from "@/lib/trigger-type";
import type { WorkflowDefinition } from "@/lib/types";

function definition(detail: string): WorkflowDefinition {
  return {
    nodes: [{ id: "trigger", kind: "trigger", title: "Start", detail, x: 0, y: 0 }],
    edges: [],
  };
}

describe("inferTriggerType", () => {
  it("recognises webhook-based triggers", () => {
    expect(inferTriggerType(definition("Trigger · Shopify webhook"))).toBe("WEBHOOK");
  });

  it("recognises event-based triggers", () => {
    expect(inferTriggerType(definition("Trigger · Gmail event"))).toBe("WEBHOOK");
  });

  it("recognises scheduled triggers", () => {
    expect(inferTriggerType(definition("Trigger · Weekly schedule"))).toBe("SCHEDULE");
  });


  it("prefers explicit typed trigger configuration over legacy labels", () => {
    const typed: WorkflowDefinition = {
      nodes: [{ id: "trigger", kind: "trigger", title: "Start", detail: "Manual", config: { triggerType: "SCHEDULE", cronExpression: "0 9 * * *", timezone: "UTC" }, x: 0, y: 0 }],
      edges: [],
    };
    expect(inferTriggerType(typed)).toBe("SCHEDULE");
  });

  it("defaults to manual when no trigger is configured", () => {
    expect(inferTriggerType({ nodes: [], edges: [] })).toBe("MANUAL");
  });
});
