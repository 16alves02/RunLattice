const SENSITIVE_KEY = /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|cookie|credential)/i;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

/** Redacts common credential fields before execution data is shown in the UI. */
export function redactExecutionData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExecutionData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactExecutionData(nested),
      ]),
    );
  }
  if (typeof value === "string") return value.replace(BEARER_TOKEN, "Bearer [REDACTED]");
  return value;
}

export function formatExecutionData(value: unknown, maximumLength = 12_000): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(redactExecutionData(value), null, 2);
  } catch {
    return "Execution data could not be displayed.";
  }
  if (typeof serialized !== "string") return "No data recorded.";
  if (serialized.length <= maximumLength) return serialized;
  return `${serialized.slice(0, maximumLength)}\n… Output truncated for display.`;
}


import type { WorkflowDefinition } from "@/lib/types";

export interface ExecutionTraceRecord {
  id: string;
  nodeId: string;
  title: string;
  kind: string;
  attempt: number;
  status: string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  result: unknown;
  error: string | null;
}

export interface ExecutionTraceItem extends ExecutionTraceRecord {
  detail?: string;
  decision?: "true" | "false";
  enteredThroughBranch?: "true" | "false";
}

/**
 * Enriches persisted execution steps with the actual configured node details
 * and the branch selected by each executed condition. It never displays
 * unexecuted nodes as if they had run.
 */
export function buildExecutionTrace(
  definition: WorkflowDefinition | undefined,
  records: readonly ExecutionTraceRecord[],
): ExecutionTraceItem[] {
  return records.map((record, index) => {
    const node = definition?.nodes.find((candidate) => candidate.id === record.nodeId);
    const result = record.result && typeof record.result === "object" && !Array.isArray(record.result)
      ? record.result as Record<string, unknown>
      : undefined;
    const decision = record.kind === "condition" && typeof result?.condition === "boolean"
      ? result.condition ? "true" : "false"
      : undefined;

    let enteredThroughBranch: "true" | "false" | undefined;
    const previous = records[index - 1];
    if (previous?.kind === "condition") {
      const previousResult = previous.result && typeof previous.result === "object" && !Array.isArray(previous.result)
        ? previous.result as Record<string, unknown>
        : undefined;
      if (typeof previousResult?.condition === "boolean") {
        const selectedBranch = previousResult.condition ? "true" : "false";
        const matchingEdge = definition?.edges.some((edge) =>
          edge.from === previous.nodeId && edge.to === record.nodeId && edge.branch === selectedBranch,
        );
        if (matchingEdge) enteredThroughBranch = selectedBranch;
      }
    }

    return {
      ...record,
      ...(node?.detail ? { detail: node.detail } : {}),
      ...(decision ? { decision } : {}),
      ...(enteredThroughBranch ? { enteredThroughBranch } : {}),
    };
  });
}
