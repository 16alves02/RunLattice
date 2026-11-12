import { describe, expect, it } from "vitest";
import type { WorkflowNode } from "@/lib/types";
import {
  getIntegration,
  getIntegrationAction,
  getRequiredIntegrationConnections,
  integrationCatalog,
  isIntegrationActionAvailable,
} from "@/lib/integrations";

describe("integration registry", () => {
  it("contains unique integration identifiers and unique operation IDs per provider", () => {
    const ids = integrationCatalog.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const integration of integrationCatalog) {
      const operationIds = integration.operations.map((operation) => operation.id);
      expect(new Set(operationIds).size).toBe(operationIds.length);
    }
  });

  it("only marks operations with real worker support as available", () => {
    for (const integration of integrationCatalog) {
      expect(integration.name.length).toBeGreaterThan(0);
      expect(integration.auth.length).toBeGreaterThan(0);
      expect(integration.actions).toEqual(integration.operations
        .filter((operation) => operation.status === "available")
        .map((operation) => operation.name));
      expect(integration.status).toBe(integration.operations.length > 0 ? "available" : "planned");
      for (const operation of integration.operations) {
        expect(operation.id.length).toBeGreaterThan(0);
        expect(operation.description.length).toBeGreaterThan(0);
        expect(operation.connectionProvider).toBeTruthy();
      }
    }
  });

  it("defines real action configuration fields and output contracts", () => {
    const discord = getIntegrationAction("discord", "send_message");
    expect(discord?.configuration.find((field) => field.id === "message")?.required).toBe(true);
    expect(discord?.outputs.map((output) => output.path)).toContain("httpStatus");

    const http = getIntegrationAction("http", "request");
    expect(http?.configuration.map((field) => field.id)).toEqual(["method", "url", "body", "responsePath"]);
    expect(http?.outputs.find((output) => output.path === "responseValue")?.availability).toBe("when_configured");

    const gmail = getIntegrationAction("gmail", "send_email");
    expect(gmail?.configuration.map((field) => field.id)).toEqual(["to", "subject", "body"]);
    expect(gmail?.connectionProvider).toBe("google");
  });

  it("does not advertise roadmap capabilities as executable actions or triggers", () => {
    for (const id of ["slack", "google-sheets", "google-drive", "shopify", "stripe", "github"]) {
      const integration = getIntegration(id);
      expect(integration?.status).toBe("planned");
      expect(integration?.actions).toEqual([]);
      expect(integration?.triggers).toEqual([]);
      expect((integration?.plannedActions.length ?? 0) + (integration?.plannedTriggers.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("looks up executable operations by stable integration and action IDs", () => {
    expect(getIntegration("discord")?.name).toBe("Discord");
    expect(getIntegrationAction("discord", "send_message")?.status).toBe("available");
    expect(isIntegrationActionAvailable("http", "request")).toBe(true);
    expect(isIntegrationActionAvailable("gmail", "send_email")).toBe(true);
    expect(isIntegrationActionAvailable("discord", "unknown")).toBe(false);
    expect(getIntegration("unknown")).toBeUndefined();
  });

  it("resolves required connection providers from the registered operation", () => {
    const nodes: WorkflowNode[] = [
      { id: "trigger", kind: "trigger", title: "Manual", detail: "", x: 0, y: 0 },
      { id: "discord", kind: "action", title: "Notify", detail: "", config: { integrationId: "discord", actionId: "send_message", connectionId: "conn-discord", message: "hello" }, x: 100, y: 0 },
      { id: "http", kind: "action", title: "Request", detail: "", config: { integrationId: "http", actionId: "request", connectionId: "conn-http", method: "GET", url: "https://api.example.com" }, x: 200, y: 0 },
      { id: "gmail", kind: "action", title: "Email", detail: "", config: { integrationId: "gmail", actionId: "send_email", connectionId: "conn-google", to: "a@example.com", subject: "Hello", body: "Message" }, x: 300, y: 0 },
    ];
    expect(getRequiredIntegrationConnections(nodes)).toEqual([
      { id: "conn-discord", provider: "discord" },
      { id: "conn-http", provider: "http" },
      { id: "conn-google", provider: "google" },
    ]);
  });

  it("rejects unknown or planned operations when resolving connections", () => {
    const nodes: WorkflowNode[] = [
      { id: "slack", kind: "action", title: "Message", detail: "", config: { integrationId: "slack", actionId: "send_message", connectionId: "conn" } as never, x: 0, y: 0 },
    ];
    expect(() => getRequiredIntegrationConnections(nodes)).toThrow(/not available/);
  });

  it("rejects reuse of one connection across different providers", () => {
    const nodes: WorkflowNode[] = [
      { id: "discord", kind: "action", title: "Notify", detail: "", config: { integrationId: "discord", actionId: "send_message", connectionId: "shared", message: "hello" }, x: 0, y: 0 },
      { id: "http", kind: "action", title: "Request", detail: "", config: { integrationId: "http", actionId: "request", connectionId: "shared", method: "GET", url: "https://api.example.com" }, x: 100, y: 0 },
    ];
    expect(() => getRequiredIntegrationConnections(nodes)).toThrow(/different integration providers/);
  });
});
