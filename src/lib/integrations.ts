export type IntegrationCategory = "Communication" | "Productivity" | "E-commerce" | "Payments" | "Development";

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  auth: "OAuth 2.0" | "Bot token" | "API key" | "Webhook";
  triggers: string[];
  actions: string[];
  status: "planned";
}

export const integrationCatalog: IntegrationDefinition[] = [
  { id: "gmail", name: "Gmail", category: "Communication", description: "React to incoming messages and prepare email actions.", auth: "OAuth 2.0", triggers: ["New email", "New attachment"], actions: ["Send email", "Add label"] , status: "planned" },
  { id: "discord", name: "Discord", category: "Communication", description: "Send messages to a Discord channel when an event occurs.", auth: "Bot token", triggers: ["New channel message"], actions: ["Send channel message"], status: "planned" },
  { id: "slack", name: "Slack", category: "Communication", description: "Connect team notifications and message events.", auth: "OAuth 2.0", triggers: ["New message"], actions: ["Send message"], status: "planned" },
  { id: "google-sheets", name: "Google Sheets", category: "Productivity", description: "Read and write rows in spreadsheets.", auth: "OAuth 2.0", triggers: ["New row"], actions: ["Append row", "Update row", "Read rows"], status: "planned" },
  { id: "google-drive", name: "Google Drive", category: "Productivity", description: "Organise files and react to new uploads.", auth: "OAuth 2.0", triggers: ["New file"], actions: ["Upload file", "Move file"], status: "planned" },
  { id: "shopify", name: "Shopify", category: "E-commerce", description: "Build order and inventory workflows for online stores.", auth: "OAuth 2.0", triggers: ["New order", "Order updated"], actions: ["Get order", "Update order"], status: "planned" },
  { id: "stripe", name: "Stripe", category: "Payments", description: "React to payment and subscription events.", auth: "OAuth 2.0", triggers: ["Payment succeeded", "Subscription updated"], actions: ["Retrieve payment", "Create refund"], status: "planned" },
  { id: "github", name: "GitHub", category: "Development", description: "Connect repository activity to engineering workflows.", auth: "OAuth 2.0", triggers: ["New issue", "Pull request opened"], actions: ["Create issue", "Add comment"], status: "planned" },
  { id: "http", name: "HTTP / REST API", category: "Development", description: "Connect services that expose an HTTP API.", auth: "API key", triggers: ["Webhook received"], actions: ["Send HTTP request"], status: "planned" },
];

export function getIntegration(id: string) {
  return integrationCatalog.find((integration) => integration.id === id);
}
