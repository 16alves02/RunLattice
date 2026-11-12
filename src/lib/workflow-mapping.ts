import type { WorkflowEdge, WorkflowNode } from "@/lib/types";

export interface WorkflowMappingOption {
  label: string;
  path: string;
  source: "trigger" | "step";
}

const TRIGGER_INPUT_FIELDS: Array<{ label: string; path: string }> = [
  { label: "Customer · Email", path: "customer.email" },
  { label: "Customer · Name", path: "customer.name" },
  { label: "Customer · Score", path: "customer.score" },
  { label: "Order · ID", path: "order.id" },
  { label: "Order · Total", path: "order.total" },
  { label: "Order · Status", path: "order.status" },
  { label: "Event · ID", path: "event.id" },
  { label: "Event · Name", path: "event.name" },
];

export function getWorkflowMappingOptions(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  targetNodeId: string,
): WorkflowMappingOption[] {
  const ancestors = new Set<string>();
  const pending = [targetNodeId];
  while (pending.length) {
    const current = pending.pop();
    if (!current || ancestors.has(current)) continue;
    ancestors.add(current);
    for (const edge of edges) {
      if (edge.to === current) pending.push(edge.from);
    }
  }

  const trigger = nodes.find((node) => node.kind === "trigger" && ancestors.has(node.id));
  const options: WorkflowMappingOption[] = trigger
    ? TRIGGER_INPUT_FIELDS.map((field) => ({
      label: `Trigger input · ${field.label}`,
      path: field.path,
      source: "trigger" as const,
    }))
    : [];

  for (const node of nodes) {
    if (!ancestors.has(node.id) || node.kind !== "action" || !node.config
      || !("integrationId" in node.config) || node.config.integrationId !== "http"
      || !/^[A-Za-z0-9_-]+$/.test(node.id)) continue;
    options.push({
      label: `${node.title} · HTTP status`,
      path: `steps.${node.id}.httpStatus`,
      source: "step",
    });
    if (node.config.responsePath?.trim()) {
      options.push({
        label: `${node.title} · HTTP response value`,
        path: `steps.${node.id}.responseValue`,
        source: "step",
      });
    }
  }
  return options;
}
