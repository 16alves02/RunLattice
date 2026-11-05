import type { ConditionConfig } from "@/lib/types";

type Scalar = string | number | boolean | null;

const blockedPathSegments = new Set(["__proto__", "prototype", "constructor"]);

function resolveInputPath(input: unknown, path: string): unknown {
  const segments = path.split(".");
  if (
    segments.length === 0
    || segments.some((segment) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) || blockedPathSegments.has(segment))
  ) {
    throw new Error("Condition input path is invalid.");
  }

  let current: unknown = input;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function isScalar(value: unknown): value is Scalar {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function evaluateCondition(config: ConditionConfig, input: unknown): boolean {
  const actual = resolveInputPath(input, config.path);
  const expected = config.value;

  switch (config.operator) {
    case "exists":
      return actual !== undefined;
    case "equals":
      return isScalar(actual) && actual === expected;
    case "not_equals":
      return isScalar(actual) && actual !== expected;
    case "contains":
      return typeof actual === "string" && typeof expected === "string"
        ? actual.includes(expected)
        : Array.isArray(actual) && isScalar(expected)
          ? actual.some((item) => isScalar(item) && item === expected)
          : false;
    case "greater_than":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "less_than":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
  }
}
