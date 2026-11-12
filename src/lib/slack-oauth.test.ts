import { describe, expect, it } from "vitest";
import { createSlackOAuthState, hashSlackOAuthState } from "@/lib/slack-oauth";

describe("Slack OAuth state", () => {
  it("creates unique high-entropy state values and stores only their hashes", () => {
    const first = createSlackOAuthState();
    const second = createSlackOAuthState();
    expect(first.state).not.toBe(second.state);
    expect(first.stateHash).toBe(hashSlackOAuthState(first.state));
    expect(first.stateHash).not.toBe(first.state);
    expect(first.stateHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
