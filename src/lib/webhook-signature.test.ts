import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature";

describe("signed webhook verification", () => {
  const secret = "test-secret-with-sufficient-entropy";
  const timestamp = "1794070809";
  const body = JSON.stringify({ orderId: "order-123", amount: 42 });

  it("accepts a valid signature for the exact raw payload", () => {
    const signature = `sha256=${signWebhookPayload(secret, timestamp, body)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody: body, nowSeconds: 1794070809 })).toBe(true);
  });

  it("rejects a changed payload", () => {
    const signature = `sha256=${signWebhookPayload(secret, timestamp, body)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody: body + " ", nowSeconds: 1794070809 })).toBe(false);
  });

  it("rejects stale timestamps and malformed headers", () => {
    const signature = `sha256=${signWebhookPayload(secret, timestamp, body)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody: body, nowSeconds: 1794071200 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp: "not-a-time", signature, rawBody: body, nowSeconds: 1794070809 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp, signature: "sha256=bad", rawBody: body, nowSeconds: 1794070809 })).toBe(false);
  });
});
