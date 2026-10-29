import type { WorkflowDefinition, WorkflowSummary } from "@/lib/types";

export const demoDefinition: WorkflowDefinition = {
  nodes: [
    { id: "trigger-1", kind: "trigger", title: "New form submission", detail: "Trigger · Webhook", x: 70, y: 90 },
    { id: "condition-1", kind: "condition", title: "Check email address", detail: "Condition · contains @", x: 350, y: 90 },
    { id: "action-1", kind: "action", title: "Create contact", detail: "Action · Save to workspace", x: 630, y: 90 },
  ],
  edges: [
    { id: "edge-1", from: "trigger-1", to: "condition-1" },
    { id: "edge-2", from: "condition-1", to: "action-1" },
  ],
};

export const demoWorkflows: WorkflowSummary[] = [
  { id: "wf-lead-capture", name: "Lead capture pipeline", description: "Validate and store new leads from a form.", status: "ACTIVE", triggerType: "WEBHOOK", updatedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(), runs: 1284 },
  { id: "wf-weekly-report", name: "Weekly report", description: "Prepare a summary for the team every Monday.", status: "ACTIVE", triggerType: "SCHEDULE", updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), runs: 42 },
  { id: "wf-support-triage", name: "Support triage", description: "Route incoming requests by category.", status: "PAUSED", triggerType: "WEBHOOK", updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 21).toISOString(), runs: 317 },
];
