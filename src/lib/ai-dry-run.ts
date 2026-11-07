import { z } from "zod";
import { resolveExecutionPath } from "@/lib/execution";
import { workflowDefinitionSchema, workflowRunInputSchema } from "@/lib/validation";

export const aiWorkflowDryRunRequestSchema = z.object({
  definition: workflowDefinitionSchema,
  input: workflowRunInputSchema.optional(),
});

export interface AIWorkflowDryRunResult {
  simulationOnly: true;
  externalSideEffectPerformed: false;
  selectedPath: Array<{
    nodeId: string;
    title: string;
    kind: string;
    outcome: "TRIGGERED" | "CONDITION_EVALUATED" | "WOULD_RUN";
  }>;
  note: string;
}

/**
 * Simulates graph traversal only. It deliberately does not invoke integration
 * adapters, read credentials, enqueue jobs or mutate third-party services.
 */
export function simulateAIWorkflow(definition: z.infer<typeof workflowDefinitionSchema>, input: Record<string, unknown> = {}): AIWorkflowDryRunResult {
  const path = resolveExecutionPath(definition, input);
  return {
    simulationOnly: true,
    externalSideEffectPerformed: false,
    selectedPath: path.map((node) => ({
      nodeId: node.id,
      title: node.title,
      kind: node.kind,
      outcome: node.kind === "trigger" ? "TRIGGERED" : node.kind === "condition" ? "CONDITION_EVALUATED" : "WOULD_RUN",
    })),
    note: "This is a graph simulation only. No integration was called and no external side effect occurred.",
  };
}
