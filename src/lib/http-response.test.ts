import { describe, expect, it } from "vitest";
import { extractJsonResponseValue } from "@/lib/http-response";

describe("HTTP JSON response mapping", () => {
  it("extracts an explicitly selected string, number, boolean or null", () => {
    const body = JSON.stringify({ data: { id: "inv_123", count: 4, active: true, optional: null } });
    expect(extractJsonResponseValue(body, "data.id")).toBe("inv_123");
    expect(extractJsonResponseValue(body, "data.count")).toBe(4);
    expect(extractJsonResponseValue(body, "data.active")).toBe(true);
    expect(extractJsonResponseValue(body, "data.optional")).toBeNull();
  });

  it("rejects missing paths, arrays, objects and oversized strings", () => {
    const body = JSON.stringify({ data: { items: [1], nested: { id: "x" }, large: "x".repeat(2_001) } });
    expect(() => extractJsonResponseValue(body, "data.missing")).toThrow(/not found/);
    expect(() => extractJsonResponseValue(body, "data.items")).toThrow(/scalar/);
    expect(() => extractJsonResponseValue(body, "data.nested")).toThrow(/scalar/);
    expect(() => extractJsonResponseValue(body, "data.large")).toThrow(/scalar/);
  });

  it("rejects malformed JSON and unsafe property paths", () => {
    expect(() => extractJsonResponseValue("{", "data.id")).toThrow(/valid JSON/);
    expect(() => extractJsonResponseValue('{"data":{"id":"x"}}', "data.__proto__.id")).toThrow(/invalid/);
    expect(() => extractJsonResponseValue('{"data":{"id":"x"}}', "data.constructor")).toThrow(/invalid/);
  });

  it("rejects invalid scalar values and invalid path lengths", () => {
    expect(() => extractJsonResponseValue('{"value":1}', "")).toThrow(/path/);
    expect(() => extractJsonResponseValue('{"value":1}', "x".repeat(201))).toThrow(/path/);
    expect(() => extractJsonResponseValue('{"value":1e400}', "value")).toThrow(/scalar/);
  });
});
