import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  const isTestKey = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  const isLiveKey = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  if (!isTestKey && !(isLiveKey && process.env.STRIPE_LIVE_MODE_ENABLED === "true")) {
    throw new Error("Stripe key mode is invalid or live mode has not been explicitly enabled.");
  }
  stripeClient ??= new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
  return stripeClient;
}

export function getAppOrigin(requestUrl: string) {
  const configuredOrigin = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(configuredOrigin || requestUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("The public application URL must use HTTPS.");
  }
  return url.origin;
}
