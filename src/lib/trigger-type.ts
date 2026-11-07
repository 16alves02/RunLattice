import type { TriggerConfig, WorkflowDefinition } from "@/lib/types";

export type TriggerType = "MANUAL" | "WEBHOOK" | "SCHEDULE";

export function inferTriggerType(definition: WorkflowDefinition): TriggerType {
  const trigger = definition.nodes.find((node) => node.kind === "trigger");
  if (trigger?.config && "triggerType" in trigger.config) return trigger.config.triggerType;

  // Backwards compatibility for definitions saved before typed trigger settings.
  const description = `${trigger?.title ?? ""} ${trigger?.detail ?? ""}`.toLowerCase();
  if (description.includes("schedule") || description.includes("weekly") || description.includes("daily")) return "SCHEDULE";
  if (description.includes("webhook") || description.includes("event")) return "WEBHOOK";
  return "MANUAL";
}

export function getTriggerConfig(definition: WorkflowDefinition): TriggerConfig {
  const trigger = definition.nodes.find((node) => node.kind === "trigger");
  if (trigger?.config && "triggerType" in trigger.config) return trigger.config;
  return { triggerType: inferTriggerType(definition) };
}
