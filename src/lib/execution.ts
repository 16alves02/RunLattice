import { evaluateCondition } from "@/lib/condition";
import type { WorkflowDefinition, WorkflowNode } from "@/lib/types";

function getOutgoingEdges(definition: WorkflowDefinition, nodeId: string) {
  return definition.edges.filter((edge) => edge.from === nodeId);
}

export function validateWorkflowGraph(definition: WorkflowDefinition): WorkflowNode[] {
  if (definition.nodes.filter((node) => node.kind === "condition").length > 1) {
    throw new Error("This execution version supports one condition node per workflow.");
  }

  const triggers = definition.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1) {
    throw new Error("A workflow must contain exactly one trigger node.");
  }

  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  for (const edge of definition.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      throw new Error("Every connection must reference an existing node.");
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    if ((incoming.get(edge.to) ?? 0) > 1) {
      throw new Error("A node cannot have multiple incoming connections.");
    }
  }

  const trigger = triggers[0];
  if (incoming.has(trigger.id)) {
    throw new Error("The trigger node cannot have an incoming connection.");
  }

  const visited = new Set<string>();
  const pending = [trigger.id];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId) continue;
    if (visited.has(nodeId)) throw new Error("Workflow connections contain a cycle.");
    visited.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) throw new Error("Workflow connection references a missing node.");
    const outgoing = getOutgoingEdges(definition, nodeId);
    if (node.kind === "condition") {
      if (outgoing.length !== 2 || !outgoing.some((edge) => edge.branch === "true") || !outgoing.some((edge) => edge.branch === "false")) {
        throw new Error("Condition nodes must have exactly one true and one false connection.");
      }
    } else if (outgoing.length > 1 || outgoing.some((edge) => edge.branch)) {
      throw new Error("Only condition nodes can have two outgoing connections.");
    }
    for (const edge of outgoing) pending.push(edge.to);
  }

  if (visited.size !== definition.nodes.length) {
    throw new Error("Every workflow node must be connected to the trigger.");
  }
  return definition.nodes;
}

export function resolveExecutionPath(definition: WorkflowDefinition, input: unknown = {}): WorkflowNode[] {
  validateWorkflowGraph(definition);
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const path: WorkflowNode[] = [];
  const visited = new Set<string>();
  let current = definition.nodes.find((node) => node.kind === "trigger");

  while (current) {
    if (visited.has(current.id)) throw new Error("Workflow connections contain a cycle.");
    visited.add(current.id);
    path.push(current);
    const outgoing = getOutgoingEdges(definition, current.id);
    if (outgoing.length === 0) break;

    let nextEdge = outgoing[0];
    if (current.kind === "condition") {
      if (!current.config || !("operator" in current.config)) {
        throw new Error(`Condition "${current.title}" has no valid rule.`);
      }
      const matches = evaluateCondition(current.config, input);
      const branch = matches ? "true" : "false";
      const selectedEdge = outgoing.find((edge) => edge.branch === branch);
      if (!selectedEdge) throw new Error(`Condition "${current.title}" has no ${branch} branch.`);
      nextEdge = selectedEdge;
    }
    current = nodesById.get(nextEdge.to);
  }

  return path;
}

export function validateExecutableWorkflow(definition: WorkflowDefinition): WorkflowNode[] {
  const nodes = validateWorkflowGraph(definition);
  const actions = nodes.filter((node) => node.kind === "action");
  if (actions.length === 0) {
    throw new Error("A live workflow must contain at least one configured action.");
  }

  for (const node of nodes) {
    if (node.kind === "condition" && (!node.config || !("operator" in node.config))) {
      throw new Error(`Condition "${node.title}" requires a valid condition rule.`);
    }
    if (node.kind === "action" && (!node.config || !("integrationId" in node.config)
      || !node.config.connectionId || !node.config.message?.trim())) {
      throw new Error(`Action "${node.title}" requires a connected integration and a message before activation.`);
    }
  }
  return nodes;
}
