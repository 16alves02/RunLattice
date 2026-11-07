import { describe, expect, it } from "vitest";
import { evaluateCondition } from "@/lib/condition";
import type { ConditionConfig } from "@/lib/types";

const rule = (operator: ConditionConfig["operator"], value?: ConditionConfig["value"]): ConditionConfig => ({
  path: "customer.score",
  operator,
  ...(value === undefined ? {} : { value }),
});

describe("condition evaluation", () => {
  const input = { customer: { score: 85, name: "Leonardo", tags: ["priority", "new"] } };

  it("compares scalar values without coercion", () => {
    expect(evaluateCondition(rule("equals", 85), input)).toBe(true);
    expect(evaluateCondition(rule("equals", "85"), input)).toBe(false);
    expect(evaluateCondition(rule("not_equals", 50), input)).toBe(true);
  });

  it("supports numeric comparisons", () => {
    expect(evaluateCondition(rule("greater_than", 80), input)).toBe(true);
    expect(evaluateCondition(rule("less_than", 90), input)).toBe(true);
    expect(evaluateCondition(rule("greater_than", "80"), input)).toBe(false);
  });

  it("supports string and array containment", () => {
    expect(evaluateCondition({ path: "customer.name", operator: "contains", value: "ardo" }, input)).toBe(true);
    expect(evaluateCondition({ path: "customer.tags", operator: "contains", value: "priority" }, input)).toBe(true);
  });

  it("checks whether a path exists", () => {
    expect(evaluateCondition({ path: "customer.name", operator: "exists" }, input)).toBe(true);
    expect(evaluateCondition({ path: "customer.email", operator: "exists" }, input)).toBe(false);
  });

  it("returns false for missing paths and incompatible types", () => {
    expect(evaluateCondition(rule("equals", 1), {})).toBe(false);
    expect(evaluateCondition({ path: "customer.name", operator: "greater_than", value: 1 }, input)).toBe(false);
  });

  it("rejects prototype-related and malformed paths", () => {
    expect(() => evaluateCondition({ path: "customer.__proto__.polluted", operator: "exists" }, input)).toThrow(/invalid/);
    expect(() => evaluateCondition({ path: "customer..name", operator: "exists" }, input)).toThrow(/invalid/);
  });
});
