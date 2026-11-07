import { z } from "zod";

const discordActionConfigSchema = z.object({
  integrationId: z.literal("discord"),
  actionId: z.literal("send_message"),
  connectionId: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
});

const conditionConfigSchema = z.object({
  path: z.string().trim().min(1).max(200).regex(/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/),
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "exists"]),
  value: z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]).optional(),
}).superRefine((config, context) => {
  if (config.operator !== "exists" && config.value === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "This condition operator requires a comparison value." });
  }
  if (config.operator === "greater_than" || config.operator === "less_than") {
    if (typeof config.value !== "number") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Numeric comparisons require a number." });
    }
  }
  if (config.operator === "contains" && config.value !== undefined && !["string", "number", "boolean"].includes(typeof config.value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Contains requires a scalar comparison value." });
  }
  if (config.path.split(".").some((segment) => ["__proto__", "prototype", "constructor"].includes(segment))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["path"], message: "Condition paths cannot access prototype properties." });
  }
});

const triggerConfigSchema = z.object({\n  triggerType: z.enum(["MANUAL", "WEBHOOK", "SCHEDULE"]),\n  cronExpression: z.string().trim().min(1).max(100).optional(),\n  timezone: z.string().trim().min(1).max(100).optional(),\n}).superRefine((config, context) => {\n  if (config.triggerType === "SCHEDULE") {\n    if (!config.cronExpression || config.cronExpression.trim().split(/\\s+/).length !== 5 || !/^[0-9*/?,\\-]+(?:\\s+[0-9*/?,\\-]+){4}$/.test(config.cronExpression.trim())) {\n      context.addIssue({ code: z.ZodIssueCode.custom, path: ["cronExpression"], message: "Use a valid five-field cron expression." });\n    }\n    if (config.timezone) {\n      try { new Intl.DateTimeFormat("en-US", { timeZone: config.timezone }); }\n      catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ["timezone"], message: "Use a valid IANA timezone." }); }\n    }\n  }\n});\n\nconst nodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["trigger", "condition", "action"]),
  title: z.string().trim().min(1).max(100),
  detail: z.string().max(500).default(""),
  config: z.union([discordActionConfigSchema, conditionConfigSchema, triggerConfigSchema]).optional(),
  x: z.number().finite().min(0).max(5000),
  y: z.number().finite().min(0).max(5000),
}).superRefine((node, context) => {
  if (node.kind === "condition" && (!node.config || !("operator" in node.config))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Condition nodes require a valid condition rule." });
  }
  if (node.kind === "action" && node.config && !("integrationId" in node.config)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Action nodes require an action configuration." });
  }
  if (node.kind === "trigger" && node.config) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Trigger nodes cannot contain a configuration." });
  }
});

const edgeSchema = z.object({
  id: z.string().min(1).max(100),
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(80),
  branch: z.enum(["true", "false"]).optional(),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(100),
  edges: z.array(edgeSchema).max(200),
}).superRefine((definition, context) => {
  const ids = new Set(definition.nodes.map((node) => node.id));
  if (definition.nodes.filter((node) => node.kind === "condition").length > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "This execution version supports one condition node per workflow." });
  }
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  if (ids.size !== definition.nodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Node identifiers must be unique." });
  }
  const outgoing = new Map<string, typeof definition.edges>();
  definition.edges.forEach((edge, index) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index], message: "Every connection must reference existing nodes." });
    }
    if (edge.from === edge.to) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index], message: "A node cannot connect to itself." });
    }
    if (edge.branch && nodesById.get(edge.from)?.kind !== "condition") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["edges", index, "branch"], message: "Only condition nodes can use true/false branch labels." });
    }
    const connections = outgoing.get(edge.from) ?? [];
    connections.push(edge);
    outgoing.set(edge.from, connections);
  });
  for (const [nodeId, connections] of outgoing) {
    const source = nodesById.get(nodeId);
    if (source?.kind === "condition") {
      const branches = connections.map((edge) => edge.branch);
      if (connections.length !== 2 || !branches.includes("true") || !branches.includes("false")) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Condition nodes must have exactly one true and one false connection." });
      }
    } else if (connections.length > 1 || connections.some((edge) => edge.branch)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Only condition nodes can have two outgoing connections." });
    }
  }
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
