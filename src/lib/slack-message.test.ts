import { describe, expect, it } from "vitest";
import { buildSlackMessagePayload, parseSlackMessageResponse } from "@/lib/slack-message";

describe("Slack message payload", () => {
  it("validates Slack channel IDs and builds safe plain-text payloads", () => {
    expect(buildSlackMessagePayload("C0123456789", "Hello")).toEqual({
      channel: "C0123456789", text: "Hello", unfurl_links: false, unfurl_media: false,
    });
    for (const channel of ["general", "C123", "https://slack.com", "C0123456789?x=1"]) {
      expect(() => buildSlackMessagePayload(channel, "Hello")).toThrow(/channel ID/);
    }
  });

  it("rejects empty and oversized messages", () => {
    expect(() => buildSlackMessagePayload("C0123456789", " ")).toThrow(/40,000/);
    expect(() => buildSlackMessagePayload("C0123456789", "x".repeat(40_001))).toThrow(/40,000/);
  });

  it("parses a successful Slack response", () => {
    expect(parseSlackMessageResponse({ ok: true, channel: "C0123456789", ts: "1731400000.123456" }))
      .toEqual({ channel: "C0123456789", ts: "1731400000.123456" });
    expect(() => parseSlackMessageResponse({ ok: false, error: "channel_not_found" })).toThrow(/channel_not_found/);
    expect(() => parseSlackMessageResponse({ ok: true, channel: "C0123456789", ts: "invalid" })).toThrow(/invalid_response/);
  });
});
