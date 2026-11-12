import { z } from "zod";

const discordActionConfigSchema = z.object({
  integrationId: z.literal("discord"),
  actionId: z.literal("send_message"),
  connectionId: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
});

const gmailActionConfigSchema = z.object({
  integrationId: z.literal("gmail"),
  actionId: z.literal("send_email"),
  connectionId: z.string().max(80).optional(),
  to: z.string().trim().min(3).max(1000),
  subject: z.string().max(500),
  body: z.string().max(100_000),
});

function googleSheetsColumnNumber(value: string) {
  return value.toUpperCase().split("").reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

function isBoundedGoogleSheetsReadRange(value: string) {
  const match = /^(?:'((?:[^']|'')+)'|([A-Za-z0-9_]+))!\\$?([A-Z]{1,3})\\$?([1-9]\\d*):\\$?([A-Z]{1,3})\\$?([1-9]\\d*)$/i.exec(value);
  if (!match) return false;
  const startColumn = googleSheetsColumnNumber(match[3]);
  const endColumn = googleSheetsColumnNumber(match[5]);
  const startRow = Number(match[4]);
  const endRow = Number(match[6]);
  return endColumn >= startColumn && endRow >= startRow
    && endColumn - startColumn + 1 <= 100 && endRow - startRow + 1 <= 1_000;
}

function isValidGoogleSheetsAppendRange(value: string) {
  return /^(?:'(?:[^']|'')+'|[A-Za-z0-9_]+)!\\$?[A-Z]{1,3}(?:\\$?[1-9]\\d*)?:\\$?[A-Z]{1,3}(?:\\$?[1-9]\\d*)?$/i.test(value);
}

const googleSheetsReadActionConfigSchema = z.object({
  integrationId: z.literal("google-sheets"),
  actionId: z.literal("read_rows"),
  connectionId: z.string().max(80).optional(),
  spreadsheetId: z.string().trim().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/),
  range: z.string().trim().min(1).max(200).refine(isBoundedGoogleSheetsReadRange, "Use a bounded A1 range of at most 1,000 rows and 100 columns, for example Sheet1!A1:D100."),
});

const googleSheetsAppendActionConfigSchema = z.object({
  integrationId: z.literal("google-sheets"),
  actionId: z.literal("append_rows"),
  connectionId: z.string().max(80).optional(),
  spreadsheetId: z.string().trim().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/),
  range: z.string().trim().min(1).max(200).refine(isValidGoogleSheetsAppendRange, "Use a valid A1 append range, for example Sheet1!A:D."),
  valuesJson: z.string().trim().min(2).max(65_536),
});

const httpActionConfigSchema = z.object({
  integrationId: z.literal("http"),
  actionId: z.literal("request"),
  connectionId: z.string().max(80).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().trim().min(1).max(2_000),
  body: z.string().max(65_536).optional(),
  responsePath: z.string().trim().max(200).regex(/^[A-Za-z_$][A-Za-z0-9_$-]*(\.[A-Za-z_$][A-Za-z0-9_$-]*)*$/).optional().or(z.literal("")),
}).superRefine((config, context) => {
  if (config.method === "GET" && config.body?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "GET requests cannot include a request body." });
  }
  if (config.responsePath?.split(".").some((segment) => ["__proto__", "prototype", "constructor"].includes(segment))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["responsePath"], message: "Response paths cannot access prototype properties." });
  }
});

const conditionConfigSchema = z.object({
  path: z.string().trim().min(1).max(200).regex(/^[A-Za-z_$][A-Za-z0-9_$-]*(\.[A-Za-z_$][A-Za-z0-9_$-]*)*$/),
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

const cronFieldRanges: Array<[number, number]> = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];

function isValidCronField(field: string, minimum: number, maximum: number) {
  if (!field || !/^[0-9*/,-]+$/.test(field)) return false;
  return field.split(",").every((part) => {
    if (!part) return false;
    const pieces = part.split("/");
    if (pieces.length > 2 || (pieces.length === 2 && (!/^\d+$/.test(pieces[1]) || Number(pieces[1]) < 1))) return false;
    const base = pieces[0];
    if (base === "*") return true;
    const range = base.split("-");
    if (range.length > 2 || range.some((value) => !/^\d+$/.test(value))) return false;
    const start = Number(range[0]);
    const end = range.length === 2 ? Number(range[1]) : start;
    return start >= minimum && start <= maximum && end >= minimum && end <= maximum && end >= start;
  });
}

const triggerConfigSchema = z.object({
  triggerType: z.enum(["MANUAL", "WEBHOOK", "SCHEDULE"]),
  cronExpression: z.string().trim().min(1).max(100).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
}).superRefine((config, context) => {
  if (config.triggerType === "SCHEDULE") {
    const fields = config.cronExpression?.trim().split(/\s+/) ?? [];
    if (fields.length !== 5 || !fields.every((field, index) => { const range = cronFieldRanges[index]; return Boolean(range && isValidCronField(field, range[0], range[1])); })) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["cronExpression"], message: "Use a valid five-field cron expression with values inside each field's range." });
    }
    if (config.timezone) {
      try { new Intl.DateTimeFormat("en-US", { timeZone: config.timezone }); }
      catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ["timezone"], message: "Use a valid IANA timezone." }); }
    }
  }
});

const nodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["trigger", "condition", "action"]),
  title: z.string().trim().min(1).max(100),
  detail: z.string().max(500).default(""),
  config: z.union([discordActionConfigSchema, gmailActionConfigSchema, googleSheetsReadActionConfigSchema, googleSheetsAppendActionConfigSchema, httpActionConfigSchema, conditionConfigSchema, triggerConfigSchema]).optional(),
  x: z.number().finite().min(0).max(5000),
  y: z.number().finite().min(0).max(5000),
}).superRefine((node, context) => {
  if (node.kind === "condition" && (!node.config || !("operator" in node.config))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Condition nodes require a valid condition rule." });
  }
  if (node.kind === "action" && node.config && !("integrationId" in node.config)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Action nodes require an action configuration." });
  }
  if (node.kind === "trigger" && node.config && !("triggerType" in node.config)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Trigger nodes require valid trigger settings." });
  }
  if (node.kind !== "trigger" && node.config && "triggerType" in node.config) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["config"], message: "Only trigger nodes can contain trigger settings." });
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

const discordConnectionSchema = z.object({
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

const httpConnectionSchema = z.object({
  provider: z.literal("http"),
  name: z.string().trim().min(2).max(60),
  baseUrl: z.string().url().max(2_000).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && Boolean(url.hostname)
        && (!url.port || url.port === "443") && !url.username && !url.password
        && !url.search && !url.hash;
    } catch {
      return false;
    }
  }, "Use an HTTPS API base URL on the standard port, without credentials, query strings or fragments."),
  apiKey: z.string().min(1).max(4_096).refine((value) => !/[\x00-\x1f\x7f]/.test(value), "API keys cannot contain control characters."),
  apiKeyHeader: z.enum(["authorization", "x-api-key"]).default("authorization"),
});

export const createIntegrationConnectionSchema = z.discriminatedUnion("provider", [
  discordConnectionSchema,
  httpConnectionSchema,
]);
