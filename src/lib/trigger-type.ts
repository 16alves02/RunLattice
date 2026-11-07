import type { WorkflowDefinition } from "@/lib/types";

export type TriggerType = "MANUAL" | "WEBHOOK" | "SCHEDULE";

export function inferTriggerType(definition: WorkflowDefinition): TriggerType {
  const trigger = definition.nodes.find((node) => node.kind === "trigger");
  const description = `${trigger?.title ?? ""} ${trigger?.detail ?? ""}`.toLowerCase();

  if (description.includes("schedule") || description.includes("weekly") || description.includes("daily")) {
    return "SCHEDULE";
  }

  if (description.includes("webhook") || description.includes("event")) {
    return "WEBHOOK";
  }

  return "MANUAL";
}
