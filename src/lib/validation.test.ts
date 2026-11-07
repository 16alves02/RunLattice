import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema, createWorkflowSchema, createIntegrationConnectionSchema, workflowRunInputSchema } from "@/lib/validation";

const validDefinition = {
  nodes: [
    { id: "trigger", kind: "trigger", title: "Start", detail: "Manual trigger", x: 0, y: 0 },
    { id: "action", kind: "action", title: "Send notification", detail: "Email adapter", x: 200, y: 0 },
  ],
  edges: [{ id: "edge-1", from: "trigger", to: "action" }],
};

describe("workflow definition validation", () => {
  it("accepts a valid graph", () => {
    expect(workflowDefinitionSchema.safeParse(validDefinition).success).toBe(true);
  });


  it("accepts typed webhook and scheduled triggers", () => {
    const webhook = {
      nodes: [{ ...validDefinition.nodes[0], config: { triggerType: "WEBHOOK" } }],
      edges: [],
    };
    const scheduled = {
      nodes: [{ ...validDefinition.nodes[0], config: { triggerType: "SCHEDULE", cronExpression: "0 9 * * 1-5", timezone: "Europe/Lisbon" } }],
      edges: [],
    };
    expect(workflowDefinitionSchema.safeParse(webhook).success).toBe(true);
    expect(workflowDefinitionSchema.safeParse(scheduled).success).toBe(true);
  });

  it("rejects out-of-range cron fields and invalid timezones", () => {
    const invalidCron = {
      nodes: [{ ...validDefinition.nodes[0], config: { triggerType: "SCHEDULE", cronExpression: "0 25 * * *", timezone: "UTC" } }],
      edges: [],
    };
    const invalidTimezone = {
      nodes: [{ ...validDefinition.nodes[0], config: { triggerType: "SCHEDULE", cronExpression: "0 9 * * *", timezone: "Mars/Olympus" } }],
      edges: [],
    };
    expect(workflowDefinitionSchema.safeParse(invalidCron).success).toBe(false);
    expect(workflowDefinitionSchema.safeParse(invalidTimezone).success).toBe(false);
  });
\n  it("rejects connections to missing nodes", () => {
    const invalid = { ...validDefinition, edges: [{ id: "edge-1", from: "trigger", to: "missing" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate node identifiers", () => {
    const invalid = { ...validDefinition, nodes: [validDefinition.nodes[0], { ...validDefinition.nodes[1], id: "trigger" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a node connected to itself", () => {
    const invalid = { ...validDefinition, edges: [{ id: "edge-1", from: "trigger", to: "trigger" }] };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires condition rules and explicit true/false branch labels", () => {
    const invalid = {
      nodes: [
        validDefinition.nodes[0],
        { id: "condition", kind: "condition", title: "Check score", detail: "", x: 100, y: 0 },
        validDefinition.nodes[1],
      ],
      edges: [
        { id: "start", from: "trigger", to: "condition" },
        { id: "branch", from: "condition", to: "action" },
      ],
    };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts a condition with safe rules and both labelled branches", () => {
    const valid = {
      nodes: [
        validDefinition.nodes[0],
        { id: "condition", kind: "condition", title: "Check score", detail: "", config: { path: "customer.score", operator: "greater_than", value: 50 }, x: 100, y: 0 },
        { ...validDefinition.nodes[1], id: "true-action" },
        { ...validDefinition.nodes[1], id: "false-action" },
      ],
      edges: [
        { id: "start", from: "trigger", to: "condition" },
        { id: "yes", from: "condition", to: "true-action", branch: "true" },
        { id: "no", from: "condition", to: "false-action", branch: "false" },
      ],
    };
    expect(workflowDefinitionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects prototype paths in condition rules", () => {
    const invalid = {
      nodes: [
        validDefinition.nodes[0],
        { id: "condition", kind: "condition", title: "Unsafe", detail: "", config: { path: "customer.__proto__.polluted", operator: "exists" }, x: 100, y: 0 },
      ],
      edges: [{ id: "start", from: "trigger", to: "condition" }],
    };
    expect(workflowDefinitionSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates workflow names before persistence", () => {
    expect(createWorkflowSchema.safeParse({ name: "A", definition: validDefinition }).success).toBe(false);
    expect(createWorkflowSchema.safeParse({ name: "Lead capture", definition: validDefinition }).success).toBe(true);
  });
});


describe("Discord integration connection validation", () => {
  const validConnection = {
    provider: "discord",
    name: "Team alerts",
    webhookUrl: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789",
  };

  it("accepts a valid HTTPS Discord webhook", () => {
    expect(createIntegrationConnectionSchema.safeParse(validConnection).success).toBe(true);
  });

  it("rejects non-Discord hosts and insecure URLs", () => {
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: "https://example.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    }).success).toBe(false);
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: validConnection.webhookUrl.replace("https:", "http:"),
    }).success).toBe(false);
  });


  it("rejects deceptive Discord hosts, credentials and non-standard ports", () => {
    const invalidUrls = [
      "https://discord.com.evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
      "https://user:password@discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
      "https://discord.com:8443/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
      "https://127.0.0.1/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
      "https://discord.com/api/webhooks/short/abcdefghijklmnopqrstuvwxyz",
      "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz/extra",
    ];

    for (const webhookUrl of invalidUrls) {
      expect(createIntegrationConnectionSchema.safeParse({
        ...validConnection,
        webhookUrl,
      }).success).toBe(false);
    }
  });

  it("accepts the official legacy discordapp.com webhook host", () => {
    const webhookUrl = validConnection.webhookUrl.replace("discord.com", "discordapp.com");
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl,
    }).success).toBe(true);
  });

  it("rejects URL query strings and fragments", () => {
    expect(createIntegrationConnectionSchema.safeParse({
      ...validConnection,
      webhookUrl: `${validConnection.webhookUrl}?redirect=https://example.com`,
    }).success).toBe(false);
  });
});


describe("workflow run input validation", () => {
  it("accepts a bounded JSON object", () => {
    expect(workflowRunInputSchema.safeParse({ customer: { email: "person@example.com" }, amount: 42 }).success).toBe(true);
  });

  it("rejects input larger than 32 KB", () => {
    expect(workflowRunInputSchema.safeParse({ payload: "x".repeat(32_769) }).success).toBe(false);
  });

  it("accepts an empty input object for manual runs", () => {
    expect(workflowRunInputSchema.safeParse({}).success).toBe(true);
  });
});
