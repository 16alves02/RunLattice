import type { WorkflowDefinition } from "@/lib/types";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "Communication" | "Development";
  integrations: string[];
  icon: "discord" | "http" | "gmail";
  setupInstructions: string;
  definition: WorkflowDefinition;
}

/**
 * Templates only use trigger types and integration operations that are
 * currently implemented. Every template is a draft and may need credentials
 * or endpoint configuration before it can be activated.
 */
export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "webhook-discord-alert",
    name: "Send webhook alerts to Discord",
    description: "Receive an incoming webhook and post a notification to a Discord channel.",
    category: "Communication",
    integrations: ["RunLattice Webhook", "Discord"],
    icon: "discord",
    setupInstructions: "Connect a Discord webhook in Integrations, select it in the action, then activate the workflow and send a test event to its generated webhook URL.",
    definition: {
      nodes: [
        { id: "trigger-webhook", kind: "trigger", title: "Incoming webhook", detail: "Trigger · RunLattice webhook", config: { triggerType: "WEBHOOK" }, x: 70, y: 90 },
        { id: "action-discord", kind: "action", title: "Send Discord alert", detail: "Action · Discord", config: { integrationId: "discord", actionId: "send_message", message: "A new webhook event was received by RunLattice." }, x: 360, y: 90 },
      ],
      edges: [{ id: "edge-webhook-discord", from: "trigger-webhook", to: "action-discord" }],
    },
  },
  {
    id: "manual-discord-notification",
    name: "Send a manual Discord notification",
    description: "Run the workflow on demand and post a prepared message to a Discord channel.",
    category: "Communication",
    integrations: ["Manual trigger", "Discord"],
    icon: "discord",
    setupInstructions: "Connect a Discord webhook in Integrations and select it in the action. You can edit the message before activating the workflow.",
    definition: {
      nodes: [
        { id: "trigger-manual", kind: "trigger", title: "Manual start", detail: "Trigger · Run on demand", config: { triggerType: "MANUAL" }, x: 70, y: 90 },
        { id: "action-discord", kind: "action", title: "Send Discord message", detail: "Action · Discord", config: { integrationId: "discord", actionId: "send_message", message: "This workflow was started manually." }, x: 360, y: 90 },
      ],
      edges: [{ id: "edge-manual-discord", from: "trigger-manual", to: "action-discord" }],
    },
  },
  {
    id: "manual-gmail-email",
    name: "Send a Gmail email",
    description: "Send a plain-text email to a recipient supplied when the workflow runs.",
    category: "Communication",
    integrations: ["Manual trigger", "Gmail"],
    icon: "gmail",
    setupInstructions: "Connect a Google account in Integrations, select it in the Gmail action, then provide an email address and optional name in the manual run input.",
    definition: {
      nodes: [
        { id: "trigger-manual", kind: "trigger", title: "Manual start", detail: "Trigger · Run on demand", config: { triggerType: "MANUAL" }, x: 70, y: 90 },
        { id: "action-gmail", kind: "action", title: "Send Gmail email", detail: "Action · Gmail", config: { integrationId: "gmail", actionId: "send_email", to: "{{input.email}}", subject: "A message from RunLattice", body: "Hello {{input.name}},\\n\\nThis message was sent by an automated workflow." }, x: 360, y: 90 },
      ],
      edges: [{ id: "edge-manual-gmail", from: "trigger-manual", to: "action-gmail" }],
    },
  },
  {
    id: "manual-http-request",
    name: "Call an external HTTPS API",
    description: "Start a workflow manually and send a secured request to an API you control.",
    category: "Development",
    integrations: ["Manual trigger", "HTTP / REST API"],
    icon: "http",
    setupInstructions: "Create an HTTP API connection in Integrations. Replace the example URL with an endpoint inside that connection's HTTPS base URL, then choose the request method and optional JSON body.",
    definition: {
      nodes: [
        { id: "trigger-manual", kind: "trigger", title: "Manual start", detail: "Trigger · Run on demand", config: { triggerType: "MANUAL" }, x: 70, y: 90 },
        { id: "action-http", kind: "action", title: "Call external API", detail: "Action · HTTP / REST API", config: { integrationId: "http", actionId: "request", method: "GET", url: "https://api.example.com/" }, x: 360, y: 90 },
      ],
      edges: [{ id: "edge-manual-http", from: "trigger-manual", to: "action-http" }],
    },
  },
];
