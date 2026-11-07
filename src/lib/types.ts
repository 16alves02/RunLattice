export type NodeKind = "trigger" | "condition" | "action";

export interface DiscordActionConfig {
  integrationId: "discord";
  actionId: "send_message";
  connectionId?: string;
  message?: string;
}

export type ConditionOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "exists";

export interface ConditionConfig {
  path: string;
  operator: ConditionOperator;
  value?: string | number | boolean | null;
}

export interface TriggerConfig {\n  triggerType: "MANUAL" | "WEBHOOK" | "SCHEDULE";\n  cronExpression?: string;\n  timezone?: string;\n}\n\nexport interface WorkflowNode {
  id: string;
  kind: NodeKind;
  title: string;
  detail: string;
  config?: DiscordActionConfig | ConditionConfig | TriggerConfig;
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
