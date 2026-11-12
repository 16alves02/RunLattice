import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "@/lib/types";

export type ConnectResult =
  | { ok: true; edges: WorkflowEdge[] }
  | { ok: false; error: string };

export function connectWorkflowNodes(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  fromId: string,
  toId: string,
  branch?: "true" | "false",
): ConnectResult {
  const source = nodes.find((node) => node.id === fromId);
  const target = nodes.find((node) => node.id === toId);
  if (!source || !target) return { ok: false, error: "Choose two existing workflow nodes." };
  if (fromId === toId) return { ok: false, error: "A node cannot connect to itself." };

  const outgoing = edges.filter((edge) => edge.from === fromId);
  if (source.kind === "condition") {
    if (!branch) return { ok: false, error: "Choose whether this is the true or false branch." };
    if (outgoing.some((edge) => edge.branch === branch)) {
      return { ok: false, error: `The ${branch} branch is already connected.` };
    }
    if (outgoing.length >= 2) return { ok: false, error: "A condition can only have true and false branches." };
  } else {
    if (branch) return { ok: false, error: "Only condition nodes can create labelled branches." };
    if (outgoing.length > 0) return { ok: false, error: "This node already has an outgoing connection." };
  }

  if (edges.some((edge) => edge.from === fromId && edge.to === toId)) {
    return { ok: false, error: "These nodes are already connected." };
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.from) ?? [];
    next.push(edge.to);
    adjacency.set(edge.from, next);
  }
  const pending = [toId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === fromId) return { ok: false, error: "This connection would create a cycle." };
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }

  if (target.kind === "trigger") return { ok: false, error: "The trigger node cannot have an incoming connection." };
  if (edges.some((edge) => edge.to === toId)) return { ok: false, error: "A node can only have one incoming connection." };

  const edge: WorkflowEdge = {
    id: `edge-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
    from: fromId,
    to: toId,
    ...(branch ? { branch } : {}),
  };
  return { ok: true, edges: [...edges, edge] };
}

export function moveWorkflowNode(
  nodes: readonly WorkflowNode[],
  nodeId: string,
  x: number,
  y: number,
): WorkflowNode[] {
  return nodes.map((node) => node.id === nodeId
    ? { ...node, x: Math.max(0, Math.min(5_000, Math.round(x))), y: Math.max(0, Math.min(5_000, Math.round(y))) }
    : node);
}

export function getWorkflowCanvasSize(nodes: readonly WorkflowNode[]) {
  return {
    width: Math.max(940, ...nodes.map((node) => node.x + 260)),
    height: Math.max(510, ...nodes.map((node) => node.y + 180)),
  };
}

export type WorkflowGraph = Pick<WorkflowDefinition, "nodes" | "edges">;
