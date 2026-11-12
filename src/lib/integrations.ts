import type { WorkflowNode } from "@/lib/types";

export type IntegrationCategory = "Communication" | "Productivity" | "E-commerce" | "Payments" | "Development";
export type IntegrationStatus = "available" | "planned";

export interface IntegrationActionDefinition {
  id: string;
  name: string;
  status: IntegrationStatus;
  connectionProvider?: "discord" | "http";
  description: string;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  auth: "OAuth 2.0" | "Bot token" | "API key" | "Webhook";
  /** Native event triggers implemented by RunLattice. */
  triggers: string[];
  /** Actions that have a real worker executor and can be activated. */
  actions: string[];
  /** Roadmap capabilities; never exposed as executable editor actions. */
  plannedTriggers: string[];
  plannedActions: string[];
  operations: IntegrationActionDefinition[];
  status: IntegrationStatus;
}

export interface RequiredIntegrationConnection {
  id: string;
  provider: "discord" | "http";
}

/**
 * The registry is the source of truth for which action identifiers can be
 * selected and executed. Adding an entry here is not enough by itself: an
 * operation is only marked available after its worker executor exists.
 */
export const integrationCatalog: IntegrationDefinition[] = [
  {
    id: "gmail", name: "Gmail", category: "Communication",
    description: "Connect email events and automate message handling.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New email", "New attachment"],
    plannedActions: ["Send email", "Add label"],
    operations: [], status: "planned",
  },
  {
    id: "discord", name: "Discord", category: "Communication",
    description: "Send messages to a Discord channel through an incoming webhook.",
    auth: "Webhook", triggers: [], actions: ["Send message"],
    plannedTriggers: [], plannedActions: [],
    operations: [{
      id: "send_message", name: "Send message", status: "available",
      connectionProvider: "discord",
      description: "Post a message through a workspace-scoped Discord webhook.",
    }],
    status: "available",
  },
  {
    id: "slack", name: "Slack", category: "Communication",
    description: "Connect team notifications and message events.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New message"],
    plannedActions: ["Send message"],
    operations: [], status: "planned",
  },
  {
    id: "google-sheets", name: "Google Sheets", category: "Productivity",
    description: "Read and write rows in spreadsheets.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New row"],
    plannedActions: ["Append row", "Update row", "Read rows"],
    operations: [], status: "planned",
  },
  {
    id: "google-drive", name: "Google Drive", category: "Productivity",
    description: "Organise files and react to new uploads.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New file"],
    plannedActions: ["Upload file", "Move file"],
    operations: [], status: "planned",
  },
  {
    id: "shopify", name: "Shopify", category: "E-commerce",
    description: "Build order and inventory workflows for online stores.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New order", "Order updated"],
    plannedActions: ["Get order", "Update order"],
    operations: [], status: "planned",
  },
  {
    id: "stripe", name: "Stripe", category: "Payments",
    description: "React to payment and subscription events.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["Payment succeeded", "Subscription updated"],
    plannedActions: ["Retrieve payment", "Create refund"],
    operations: [], status: "planned",
  },
  {
    id: "github", name: "GitHub", category: "Development",
    description: "Connect repository activity to engineering workflows.",
    auth: "OAuth 2.0", triggers: [], actions: [],
    plannedTriggers: ["New issue", "Pull request opened"],
    plannedActions: ["Create issue", "Add comment"],
    operations: [], status: "planned",
  },
  {
    id: "http", name: "HTTP / REST API", category: "Development",
    description: "Send secured HTTPS requests to external APIs with workspace-scoped API keys.",
    auth: "API key", triggers: [], actions: ["Send HTTP request"],
    plannedTriggers: [], plannedActions: [],
    operations: [{
      id: "request", name: "Send HTTP request", status: "available",
      connectionProvider: "http",
      description: "Send a secured HTTPS request to the configured API origin.",
    }],
    status: "available",
  },
];

export function getIntegration(id: string) {
  return integrationCatalog.find((integration) => integration.id === id);
}

export function getIntegrationAction(integrationId: string, actionId: string) {
  return getIntegration(integrationId)?.operations.find(
    (operation) => operation.id === actionId && operation.status === "available",
  );
}

export function isIntegrationActionAvailable(integrationId: string, actionId: string) {
  return Boolean(getIntegrationAction(integrationId, actionId));
}

/**
 * Resolves the provider expected by each configured action connection.
 * A connection ID cannot safely represent two different providers in one workflow.
 */
export function getRequiredIntegrationConnections(
  nodes: readonly WorkflowNode[],
): RequiredIntegrationConnection[] {
  const requirements = new Map<string, "discord" | "http">();

  for (const node of nodes) {
    if (node.kind !== "action" || !node.config || !("integrationId" in node.config) || !node.config.connectionId) {
      continue;
    }

    const operation = getIntegrationAction(node.config.integrationId, node.config.actionId);
    if (!operation?.connectionProvider) {
      throw new Error(`Action "${node.title}" uses an integration operation that is not available.`);
    }
    const provider = operation.connectionProvider;
    const existingProvider = requirements.get(node.config.connectionId);
    if (existingProvider && existingProvider !== provider) {
      throw new Error("A workflow connection cannot be used with different integration providers.");
    }
    requirements.set(node.config.connectionId, provider);
  }

  return [...requirements].map(([id, provider]) => ({ id, provider }));
}
