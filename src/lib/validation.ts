import { z } from "zod";

const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["trigger", "condition", "action"]),
  title: z.string().trim().min(1).max(100),
  detail: z.string().max(500).default(""),
  x: z.number().finite().min(0).max(5000),
  y: z.number().finite().min(0).max(5000),
});

const edgeSchema = z.object({
  id: z.string().min(1).max(100),
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(80),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(100),
  edges: z.array(edgeSchema).max(200),
}).superRefine((definition, context) => {
  const ids = new Set(definition.nodes.map((node) => node.id));
  if (ids.size !== definition.nodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Node identifiers must be unique." });
  }
  definition.edges.forEach((edge, index) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index], message: "Every connection must reference existing nodes." });
    }
    if (edge.from === edge.to) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index], message: "A node cannot connect to itself." });
    }
  });
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  definition: workflowDefinitionSchema,
});
