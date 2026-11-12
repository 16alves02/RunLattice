import { describe, expect, it } from "vitest";
import { getRequiredIntegrationConnections } from "@/lib/integrations";
import type { WorkflowNode } from "@/lib/types";

function actionNode(
  id: string,
  integrationId: "discord" | "http",
  connectionId: string,
): WorkflowNode {
  return {
    id,
    kind: "action",
    title: id,
    detail: "",
    config: integrationId === "discord"
      ? { integrationId, actionId: "send_message", connectionId, message: "Hello" }
      : { integrationId, actionId: "request", connectionId, method: "GET", url: "https://api.example.com" },
    x: 0,
    y: 0,
  };
}

describe("workflow integration connection requirements", () => {
  it("keeps the expected provider for Discord and HTTP actions", () => {
    expect(getRequiredIntegrationConnections([
      actionNode("discord-action", "discord", "discord-connection"),
      actionNode("http-action", "http", "http-connection"),
    ])).toEqual([
      { id: "discord-connection", provider: "discord" },
      { id: "http-connection", provider: "http" },
    ]);
  });

  it("deduplicates a connection reused by actions from the same provider", () => {
    expect(getRequiredIntegrationConnections([
      actionNode("first", "http", "shared-http"),
      actionNode("second", "http", "shared-http"),
    ])).toEqual([{ id: "shared-http", provider: "http" }]);
  });

  it("rejects reusing one connection ID across different providers", () => {
    expect(() => getRequiredIntegrationConnections([
      actionNode("discord-action", "discord", "shared"),
      actionNode("http-action", "http", "shared"),
    ])).toThrow("A workflow connection cannot be used with different integration providers.");
  });
});
