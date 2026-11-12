import { describe, expect, it } from "vitest";
import { getIntegrationAction } from "@/lib/integrations";
import { workflowDefinitionSchema } from "@/lib/validation";
import { workflowTemplates } from "@/lib/workflow-templates";

describe("workflow starter templates", () => {
  it("has unique identifiers and valid workflow definitions", () => {
    const ids = workflowTemplates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of workflowTemplates) {
      expect(workflowDefinitionSchema.safeParse(template.definition).success).toBe(true);
      expect(template.setupInstructions.length).toBeGreaterThan(20);
    }
  });

  it("only uses trigger types and integration operations supported by this release", () => {
    const supportedTriggers = new Set(["MANUAL", "WEBHOOK", "SCHEDULE"]);
    for (const template of workflowTemplates) {
      for (const node of template.definition.nodes) {
        if (node.kind === "trigger") {
          expect(node.config && "triggerType" in node.config ? supportedTriggers.has(node.config.triggerType) : false).toBe(true);
        }
        if (node.kind === "action") {
          expect(node.config && "integrationId" in node.config
            ? getIntegrationAction(node.config.integrationId, node.config.actionId)
            : undefined).toBeTruthy();
        }
      }
    }
  });

  it("keeps external credentials and workspace connections out of template definitions", () => {
    for (const template of workflowTemplates) {
      for (const node of template.definition.nodes) {
        if (node.kind !== "action" || !node.config || !("integrationId" in node.config)) continue;
        expect(node.config.connectionId).toBeUndefined();
        expect(JSON.stringify(node.config)).not.toMatch(/apiKey|webhookUrl|token/i);
      }
    }
  });
});
