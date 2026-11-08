import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, resolveEntitledPlan } from "./billing-core";

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

  it("recognizes Business subscriptions", () => {
    expect(resolveEntitledPlan({
      plan: "business",
      status: "active",
      currentPeriodEnd: new Date("2026-12-07T12:00:00.000Z"),
    }, now)).toBe("business");
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

describe("plan limits", () => {
  it("defines the agreed monthly execution and AI credit tiers", () => {
    expect(PLAN_LIMITS.free.monthlyRuns).toBe(100);
    expect(PLAN_LIMITS.pro.monthlyRuns).toBe(1_000);
    expect(PLAN_LIMITS.team.monthlyRuns).toBe(5_000);
    expect(PLAN_LIMITS.business.monthlyRuns).toBe(20_000);
    expect(PLAN_LIMITS.free.aiRequests).toBe(10);
    expect(PLAN_LIMITS.pro.aiRequests).toBe(100);
    expect(PLAN_LIMITS.team.aiRequests).toBe(400);
    expect(PLAN_LIMITS.business.aiRequests).toBe(1_200);
  });

  it("keeps direct resource limits bounded on every plan", () => {
    for (const limits of Object.values(PLAN_LIMITS)) {
      expect(limits.workflows).toBeGreaterThan(0);
      expect(limits.monthlyRuns).toBeGreaterThan(0);
      expect(limits.members).toBeGreaterThan(0);
      expect(limits.integrations).toBeGreaterThan(0);
      expect(limits.aiTokens).toBeGreaterThan(0);
      expect(limits.historyDays).toBeGreaterThan(0);
      expect(limits.concurrentRuns).toBeGreaterThan(0);
    }
  });
});
