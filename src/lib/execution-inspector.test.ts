import { describe, expect, it } from "vitest";
import { formatExecutionData, redactExecutionData } from "@/lib/execution-inspector";

describe("execution inspector data redaction", () => {
  it("redacts sensitive object fields recursively", () => {
    expect(redactExecutionData({
      message: "sent",
      credentials: { apiKey: "private-key" },
      nested: [{ access_token: "private-token", value: 42 }],
    })).toEqual({
      message: "sent",
      credentials: "[REDACTED]",
      nested: [{ access_token: "[REDACTED]", value: 42 }],
    });
  });

  it("redacts bearer credentials embedded in strings", () => {
    expect(formatExecutionData({ header: "Bearer abc.def.ghi" })).toContain("Bearer [REDACTED]");
    expect(formatExecutionData({ header: "Bearer abc.def.ghi" })).not.toContain("abc.def.ghi");
  });

  it("truncates oversized execution data", () => {
    const formatted = formatExecutionData({ payload: "x".repeat(100) }, 30);
    expect(formatted.length).toBeLessThan(100);
    expect(formatted).toContain("Output truncated");
  });
});
