import { z } from "zod";
import { workflowDefinitionSchema } from "@/lib/validation";

export const aiWorkflowRequestSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
});

export const aiWorkflowPlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
  definition: workflowDefinitionSchema,
});

export type AIWorkflowPlan = z.infer<typeof aiWorkflowPlanSchema>;

export function buildWorkflowPrompt(userRequest: string, integrationNames: string[]) {
  return [
    "You are the workflow planning assistant for RunLattice.",
    "Return only a JSON object with name, description and definition.",
    "definition must contain nodes and edges. Each node must have id, kind (trigger, condition, action), title, detail, x and y.",
    "Use only services from this allow-list when naming integrations: " + integrationNames.join(", ") + ".",
    "Do not claim that integrations are connected. Do not generate code, secrets, credentials or executable expressions.",
    "Create a clear draft plan. Use a trigger first, then conditions/actions in execution order.",
    "If the user's request needs a service outside the allow-list, explain the missing service in the description and use a generic manual trigger rather than inventing an integration.",
    "User request: " + userRequest,
  ].join("\n");
}
