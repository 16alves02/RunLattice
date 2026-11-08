import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature";

describe("signed webhook signatures", () => {
  const secret = "a-secret-that-is-never-stored-in-plain-text";
  const rawBody = JSON.stringify({ event: "order.created", orderId: "ord_123" });
  const timestamp = "1794070800";
  const deliveryId = "delivery_test_123";

  it("accepts a valid signature inside the replay window", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, deliveryId, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId, signature, rawBody, nowSeconds: 1794070801 })).toBe(true);
  });

  it("rejects a modified body or delivery identifier", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, deliveryId, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId, signature, rawBody: rawBody + " ", nowSeconds: 1794070801 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId: "delivery_other_123", signature, rawBody, nowSeconds: 1794070801 })).toBe(false);
  });

  it("rejects stale timestamps and malformed headers", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, deliveryId, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId, signature, rawBody, nowSeconds: 1794071200 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp: "bad", deliveryId, signature, rawBody, nowSeconds: 1794070801 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId, signature: "v1=abc", rawBody, nowSeconds: 1794070801 })).toBe(false);
  });

  it("rejects a missing or invalid delivery identifier", () => {
    const signature = `v1=${signWebhookPayload(secret, timestamp, deliveryId, rawBody)}`;
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId: null, signature, rawBody, nowSeconds: 1794070801 })).toBe(false);
    expect(verifyWebhookSignature({ secret, timestamp, deliveryId: "short", signature, rawBody, nowSeconds: 1794070801 })).toBe(false);
  });
});
