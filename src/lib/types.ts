export type NodeKind = "trigger" | "condition" | "action";

export interface DiscordActionConfig {
  integrationId: "discord";
  actionId: "send_message";
  connectionId?: string;
  message?: string;
}

export interface GmailActionConfig {
  integrationId: "gmail";
  actionId: "send_email";
  connectionId?: string;
  to: string;
  subject: string;
  body: string;
}

export interface GoogleSheetsReadConfig {
  integrationId: "google-sheets";
  actionId: "read_rows";
  connectionId?: string;
  spreadsheetId: string;
  range: string;
}

export interface GoogleSheetsAppendConfig {
  integrationId: "google-sheets";
  actionId: "append_rows";
  connectionId?: string;
  spreadsheetId: string;
  range: string;
  valuesJson: string;
}

export interface HttpActionConfig {
  integrationId: "http";
  actionId: "request";
  connectionId?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: string;
  responsePath?: string;
}

export type ConditionOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "exists";

export interface ConditionConfig {
  path: string;
  operator: ConditionOperator;
  value?: string | number | boolean | null;
}

export interface TriggerConfig {
  triggerType: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  cronExpression?: string;
  timezone?: string;
}

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  title: string;
  detail: string;
  config?: DiscordActionConfig | GmailActionConfig | GoogleSheetsReadConfig | GoogleSheetsAppendConfig | HttpActionConfig | ConditionConfig | TriggerConfig;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  branch?: "true" | "false";
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "PAUSED" | "DRAFT";
  triggerType: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  updatedAt: string;
  runs: number;
}
