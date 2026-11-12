import { describe, expect, it } from "vitest";
import {
  parseGoogleSheetsAppendResponse,
  parseGoogleSheetsAppendValues,
  parseGoogleSheetsReadResponse,
  readGoogleSheetsJsonResponse,
} from "@/lib/google-sheets";

describe("Google Sheets payload validation", () => {
  it("parses valid rows and rejects non-scalar, non-finite or oversized values", () => {
    expect(parseGoogleSheetsAppendValues('[["Ada",42,true]]')).toEqual([["Ada", 42, true]]);
    for (const invalid of ["{}", "[]", "[[]]", "[[null]]", "[[{}]]", "[[1e999]]", JSON.stringify([["x".repeat(10_001)]])]) {
      expect(() => parseGoogleSheetsAppendValues(invalid)).toThrow();
    }
  });

  it("enforces the 10,000-cell append limit", () => {
    const tooManyCells = JSON.stringify(Array.from({ length: 101 }, () => Array(100).fill("x")));
    expect(() => parseGoogleSheetsAppendValues(tooManyCells)).toThrow(/10,000 cells/);
  });

  it("normalizes read results and rejects oversized ranges", () => {
    expect(parseGoogleSheetsReadResponse({ range: "Sheet1!A1:B1", values: [["Ada", 42]] })).toEqual({
      rowCount: 1, values: [["Ada", 42]],
    });
    expect(parseGoogleSheetsReadResponse({ range: "Sheet1!A1:B1" })).toEqual({ rowCount: 0, values: [] });
    expect(() => parseGoogleSheetsReadResponse({ values: [[null]] })).toThrow();
    expect(() => parseGoogleSheetsReadResponse({ values: Array.from({ length: 101 }, () => Array(100).fill("x")) })).toThrow(/10,000 cells/);
  });

  it("validates append confirmations", () => {
    expect(parseGoogleSheetsAppendResponse({ updates: { updatedRange: "Sheet1!A1:C1", updatedRows: 1 } }))
      .toEqual({ updatedRange: "Sheet1!A1:C1", updatedRows: 1 });
    expect(() => parseGoogleSheetsAppendResponse({ updates: { updatedRange: "Sheet1!A1:C1", updatedRows: -1 } })).toThrow();
  });

  it("reads bounded JSON responses and rejects responses above the byte limit", async () => {
    const response = new Response(JSON.stringify({ values: [["ok"]] }));
    expect(await readGoogleSheetsJsonResponse(response)).toEqual({ values: [["ok"]] });
    const oversized = new Response("x".repeat(100));
    await expect(readGoogleSheetsJsonResponse(oversized, 20)).rejects.toThrow(/2 MB execution limit/);
  });
});
