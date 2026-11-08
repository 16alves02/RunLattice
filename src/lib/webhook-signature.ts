import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const DELIVERY_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function signWebhookPayload(secret: string, timestamp: string, deliveryId: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${deliveryId}.${rawBody}`, "utf8").digest("hex");
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string | null;
  deliveryId: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
}) {
  const { secret, timestamp, deliveryId, signature, rawBody, nowSeconds = Math.floor(Date.now() / 1000) } = input;
  if (!secret || !timestamp || !deliveryId || !signature || !/^\d{10}$/.test(timestamp) || !DELIVERY_ID_PATTERN.test(deliveryId)) return false;
  const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp) || Math.abs(nowSeconds - parsedTimestamp) > MAX_CLOCK_SKEW_SECONDS) return false;
  const supplied = signature.startsWith("v1=") ? signature.slice(3) : "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = signWebhookPayload(secret, timestamp, deliveryId, rawBody);
  const left = Buffer.from(supplied, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
