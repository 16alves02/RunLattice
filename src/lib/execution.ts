import type { WorkflowDefinition, WorkflowNode } from "@/lib/types";

export function resolveExecutionPath(definition: WorkflowDefinition): WorkflowNode[] {
  const triggers = definition.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1) {
    throw new Error("A workflow must contain exactly one trigger node.");
  }

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string>();

  for (const edge of definition.edges) {
    if (outgoing.has(edge.from)) {
      throw new Error("Branching connections are not supported by this execution version.");
    }
    outgoing.set(edge.from, edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    if ((incoming.get(edge.to) ?? 0) > 1) {
      throw new Error("A node cannot have multiple incoming connections in this execution version.");
    }
  }

  const start = triggers[0];
  if (incoming.has(start.id)) {
    throw new Error("The trigger node cannot have an incoming connection.");
  }

  const path: WorkflowNode[] = [];
  const visited = new Set<string>();
  let current: WorkflowNode | undefined = start;

  while (current) {
    if (visited.has(current.id)) throw new Error("Workflow connections contain a cycle.");
    visited.add(current.id);
    path.push(current);
    const nextId = outgoing.get(current.id);
    current = nextId ? definition.nodes.find((node) => node.id === nextId) : undefined;
  }

  if (path.length !== definition.nodes.length) {
    throw new Error("Every workflow node must be connected to the trigger in a single execution path.");
  }

  return path;
}

export function validateExecutableWorkflow(definition: WorkflowDefinition): WorkflowNode[] {
  const path = resolveExecutionPath(definition);
  if (!path.some((node) => node.kind === "action")) {
    throw new Error("A live workflow must contain at least one configured action.");
  }

  for (const node of path) {
    if (node.kind === "condition") {
      throw new Error("Condition nodes are not available in this execution version. Remove them before activating the workflow.");
    }
    if (node.kind === "action" && (!node.config?.connectionId || !node.config.message?.trim())) {
      throw new Error(`Action "${node.title}" requires a connected integration and a message before activation.`);
    }
  }

  return path;
}
