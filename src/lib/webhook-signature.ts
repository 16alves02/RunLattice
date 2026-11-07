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
  if (!secret || !timestamp || !signature || !/^\d{10}$/.test(timestamp)) return false;
  const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp) || Math.abs(nowSeconds - parsedTimestamp) > MAX_CLOCK_SKEW_SECONDS) return false;
  const supplied = signature.startsWith("v1=") ? signature.slice(3) : "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = signWebhookPayload(secret, timestamp, rawBody);
  const left = Buffer.from(supplied, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
