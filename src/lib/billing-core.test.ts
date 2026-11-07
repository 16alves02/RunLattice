import { describe, expect, it } from "vitest";
import { resolveEntitledPlan } from "./billing-core";

const now = new Date("2026-11-07T12:00:00.000Z");

describe("resolveEntitledPlan", () => {
  it("defaults to free without a subscription", () => {
    expect(resolveEntitledPlan(null, now)).toBe("free");
  });

  it("grants an active paid plan", () => {
    expect(resolveEntitledPlan({
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-12-07T12:00:00.000Z"),
    }, now)).toBe("pro");
  });

  it("keeps access during a past-due grace period", () => {
    expect(resolveEntitledPlan({
      plan: "team",
      status: "past_due",
      currentPeriodEnd: new Date("2026-12-07T12:00:00.000Z"),
    }, now)).toBe("team");
  });

  it("removes access when a paid period expires", () => {
    expect(resolveEntitledPlan({
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-11-06T12:00:00.000Z"),
    }, now)).toBe("free");
  });

  it("does not trust unknown plan names", () => {
    expect(resolveEntitledPlan({
      plan: "enterprise",
      status: "active",
      currentPeriodEnd: null,
    }, now)).toBe("free");
  });
});
