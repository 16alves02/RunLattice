import { hashGoogleOAuthState } from "@/lib/google-oauth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { PLAN_LIMITS, resolveEntitledPlan } from "@/lib/billing-core";

export const runtime = "nodejs";

function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (!value) throw new Error("The application URL is not configured.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("The production application URL must use HTTPS.");
  return url;
}

function redirectToIntegrations(result: "connected" | "error", reason?: string) {
  const url = new URL("/integrations", getAppUrl());
  url.searchParams.set("google", result);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  if (!state || state.length > 200) return redirectToIntegrations("error", "invalid_state");

  const stateHash = hashGoogleOAuthState(state);
  const now = new Date();
  try {
    const oauthState = await prisma.googleOAuthState.findUnique({ where: { stateHash } });
    if (!oauthState || oauthState.consumedAt || oauthState.expiresAt <= now) {
      return redirectToIntegrations("error", "expired_state");
    }
    const consumed = await prisma.googleOAuthState.updateMany({
      where: { id: oauthState.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return redirectToIntegrations("error", "reused_state");
    if (providerError || !code || code.length > 4_096) return redirectToIntegrations("error", "authorization_denied");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return redirectToIntegrations("error", "oauth_not_configured");

    const verifier = decryptSecret(
      oauthState.codeVerifierCiphertext,
      `${oauthState.organizationId}:google-oauth:${stateHash}`,
    );
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) return redirectToIntegrations("error", "token_exchange_failed");
    const tokens: unknown = await tokenResponse.json();
    if (!tokens || typeof tokens !== "object" || !("access_token" in tokens)
      || typeof tokens.access_token !== "string" || !tokens.access_token
      || !("expires_in" in tokens) || typeof tokens.expires_in !== "number"
      || !("scope" in tokens) || typeof tokens.scope !== "string") {
      return redirectToIntegrations("error", "invalid_token_response");
    }
    const tokenData = tokens as { access_token: string; refresh_token?: unknown; expires_in: number; scope: string; token_type?: unknown };
    if (tokenData.expires_in < 60 || tokenData.expires_in > 86_400 || tokenData.token_type !== "Bearer") {
      return redirectToIntegrations("error", "invalid_token_response");
    }
    if (!tokenData.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.send")) {
      return redirectToIntegrations("error", "required_scope_missing");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) return redirectToIntegrations("error", "profile_lookup_failed");
    const profile: unknown = await profileResponse.json();
    if (!profile || typeof profile !== "object" || !("email" in profile)
      || typeof profile.email !== "string" || !profile.email.includes("@")
      || !("email_verified" in profile) || profile.email_verified !== true) {
      return redirectToIntegrations("error", "unverified_google_account");
    }
    const email = profile.email.trim().toLowerCase();
    const saved = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${oauthState.organizationId}, 0))`;
      const existing = await transaction.integrationConnection.findFirst({
        where: { organizationId: oauthState.organizationId, provider: "google", name: email },
        select: { id: true, credentialsCiphertext: true },
      });

      let refreshToken = typeof tokenData.refresh_token === "string" && tokenData.refresh_token
        ? tokenData.refresh_token
        : undefined;
      if (!refreshToken && existing) {
        try {
          const previous: unknown = JSON.parse(decryptSecret(existing.credentialsCiphertext, `${oauthState.organizationId}:google`));
          if (previous && typeof previous === "object" && "refreshToken" in previous && typeof previous.refreshToken === "string") {
            refreshToken = previous.refreshToken;
          }
        } catch {
          throw new Error("The stored Google connection is invalid.");
        }
      }
      if (!refreshToken) throw new Error("Google did not provide an offline refresh token.");

      if (!existing) {
        const subscription = await transaction.billingSubscription.findUnique({
          where: { organizationId: oauthState.organizationId },
          select: { plan: true, status: true, currentPeriodEnd: true },
        });
        const limit = PLAN_LIMITS[resolveEntitledPlan(subscription)].integrations;
        const used = await transaction.integrationConnection.count({
          where: { organizationId: oauthState.organizationId },
        });
        if (used >= limit) return false;
      }

      const credentialsCiphertext = encryptSecret(JSON.stringify({
        accessToken: tokenData.access_token,
        refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        email,
      }), `${oauthState.organizationId}:google`);

      if (existing) {
        await transaction.integrationConnection.updateMany({
          where: { id: existing.id, organizationId: oauthState.organizationId, provider: "google" },
          data: { credentialsCiphertext },
        });
      } else {
        await transaction.integrationConnection.create({
          data: {
            organizationId: oauthState.organizationId,
            provider: "google",
            name: email,
            credentialsCiphertext,
          },
        });
      }
      return true;
    });
    if (!saved) return redirectToIntegrations("error", "connection_limit_reached");
    return redirectToIntegrations("connected");
  } catch {
    return redirectToIntegrations("error", "connection_failed");
  }
}
