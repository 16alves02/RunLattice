import { describe, expect, it } from "vitest";
import { integrationCatalog, getIntegration } from "@/lib/integrations";

describe("integration catalog", () => {
  it("contains unique integration identifiers", () => {
    const ids = integrationCatalog.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines authentication and capabilities for each integration", () => {
    for (const integration of integrationCatalog) {
      expect(integration.name.length).toBeGreaterThan(0);
      expect(integration.auth.length).toBeGreaterThan(0);
      expect(integration.triggers.length + integration.actions.length).toBeGreaterThan(0);
      expect(integration.status).toBe("planned");
    }
  });

  it("looks up a provider by its stable identifier", () => {
    expect(getIntegration("discord")?.name).toBe("Discord");
    expect(getIntegration("unknown")).toBeUndefined();
  });
});
