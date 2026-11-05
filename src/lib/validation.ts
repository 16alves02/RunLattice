import { z } from "zod";

const discordActionConfigSchema = z.object({
  integrationId: z.literal("discord"),
  actionId: z.literal("send_message"),
  connectionId: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["trigger", "condition", "action"]),
  title: z.string().trim().min(1).max(100),
  detail: z.string().max(500).default(""),
  config: discordActionConfigSchema.optional(),
  x: z.number().finite().min(0).max(5000),
  y: z.number().finite().min(0).max(5000),
}).superRefine((node, context) => {
  if (node.config && node.kind !== "action") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["config"],
      message: "Only action nodes can contain an action configuration.",
    });
  }
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

export const workflowRunInputSchema = z.record(z.string(), z.unknown()).superRefine((input, context) => {
  try {
    const serialized = JSON.stringify(input);
    if (typeof serialized !== "string" || new TextEncoder().encode(serialized).byteLength > 32_768) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Workflow input must be valid JSON data of 32 KB or smaller.",
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Workflow input must be valid JSON data.",
    });
  }
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  definition: workflowDefinitionSchema,
});

export const createIntegrationConnectionSchema = z.object({
  provider: z.literal("discord"),
  name: z.string().trim().min(2).max(60),
  webhookUrl: z.string().url().max(1000).refine((value) => {
    try {
      const url = new URL(value);
      const validHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
      const validPath = /^\/api\/webhooks\/\d{10,25}\/[A-Za-z0-9._-]{20,200}\/?$/.test(url.pathname);
      return url.protocol === "https:" && validHost && (!url.port || url.port === "443")
        && !url.username && !url.password && !url.search && !url.hash && validPath;
    } catch {
      return false;
    }
  }, "Use a valid HTTPS Discord webhook URL."),
});
