import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature";

describe("signed webhook signatures", () => {
  const secret = "a-secret-that-is-never-stored-in-plain-text";
  const rawBody = JSON.stringify({ event: "order.created", orderId: "ord_123" });
  const timestamp = "1794070800";

  it("accepts a valid signature inside the replay window", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody, nowSeconds: 1794070801 })).toBe(true);
  });

  it("rejects a modified body", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody: rawBody + " ", nowSeconds: 1794070801 })).toBe(false);
  });

  it("rejects stale timestamps and malformed headers", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, signature, rawBody, nowSeconds: 1794071200 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp: "bad", signature, rawBody, nowSeconds: 1794070801 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp, signature: "v1=abc", rawBody, nowSeconds: 1794070801 })).toBe(false);
  });
});
