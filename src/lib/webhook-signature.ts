import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export function signWebhookPayload(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
}) {
  const { secret, timestamp, signature, rawBody, nowSeconds = Math.floor(Date.now() / 1000) } = input;
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) return false;

  const expected = Buffer.from(`sha256=${signWebhookPayload(secret, timestamp, rawBody)}`, "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
