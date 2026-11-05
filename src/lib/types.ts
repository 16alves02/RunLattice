export type NodeKind = "trigger" | "condition" | "action";

export interface DiscordActionConfig {
  integrationId: "discord";
  actionId: "send_message";
  connectionId: string;
  message: string;
}

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  title: string;
  detail: string;
  config?: DiscordActionConfig;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
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
