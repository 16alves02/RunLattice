import { hashSlackOAuthState } from "@/lib/slack-oauth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { PLAN_LIMITS, resolveEntitledPlan } from "@/lib/billing-core";
import { canManageWorkspace } from "@/lib/workspace";

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
  url.searchParams.set("slack", result);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const providerError = requestUrl.searchParams.get("error");
  if (!state || state.length > 200) return redirectToIntegrations("error", "invalid_state");

  const stateHash = hashSlackOAuthState(state);
  const now = new Date();
  try {
    const oauthState = await prisma.slackOAuthState.findUnique({ where: { stateHash } });
    if (!oauthState || oauthState.consumedAt || oauthState.expiresAt <= now) {
      return redirectToIntegrations("error", "expired_state");
    }
    const consumed = await prisma.slackOAuthState.updateMany({
      where: { id: oauthState.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return redirectToIntegrations("error", "reused_state");
    if (providerError || !code || code.length > 4_096) return redirectToIntegrations("error", "authorization_denied");

    const currentMembership = await prisma.member.findFirst({
      where: { userId: oauthState.userId, organizationId: oauthState.organizationId },
      select: { role: true },
    });
    if (!currentMembership || !canManageWorkspace(currentMembership.role)) {
      return redirectToIntegrations("error", "workspace_permission_changed");
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return redirectToIntegrations("error", "oauth_not_configured");

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        authorization: `Basic ${basicAuth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ code, redirect_uri: redirectUri }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) return redirectToIntegrations("error", "token_exchange_failed");
    const tokenData: unknown = await tokenResponse.json();
    if (!tokenData || typeof tokenData !== "object" || !("ok" in tokenData) || tokenData.ok !== true
      || !("access_token" in tokenData) || typeof tokenData.access_token !== "string" || !tokenData.access_token
      || !("token_type" in tokenData) || tokenData.token_type !== "bot"
      || !("scope" in tokenData) || typeof tokenData.scope !== "string"
      || !("team" in tokenData) || !tokenData.team || typeof tokenData.team !== "object"
      || !("id" in tokenData.team) || typeof tokenData.team.id !== "string"
      || !("name" in tokenData.team) || typeof tokenData.team.name !== "string") {
      return redirectToIntegrations("error", "invalid_token_response");
    }
    const grantedScopes = new Set(tokenData.scope.split(",").map((scope) => scope.trim()));
    if (!grantedScopes.has("chat:write")) return redirectToIntegrations("error", "required_scope_missing");

    const expiresIn = "expires_in" in tokenData ? tokenData.expires_in : undefined;
    const refreshTokenValue = "refresh_token" in tokenData ? tokenData.refresh_token : undefined;
    if (expiresIn !== undefined && (typeof expiresIn !== "number" || expiresIn < 60 || expiresIn > 86_400
      || typeof refreshTokenValue !== "string" || !refreshTokenValue)) {
      return redirectToIntegrations("error", "invalid_token_response");
    }
    const teamId = tokenData.team.id;
    const teamName = tokenData.team.name.trim().slice(0, 80);
    if (!/^T[A-Z0-9]{8,}$/.test(teamId) || !teamName) return redirectToIntegrations("error", "invalid_workspace");

    const connectionName = `${teamName} (${teamId})`;
    const saved = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${oauthState.organizationId}, 0))`;
      const existing = await transaction.integrationConnection.findFirst({
        where: { organizationId: oauthState.organizationId, provider: "slack", name: connectionName },
        select: { id: true, credentialsCiphertext: true },
      });

      let refreshToken = typeof refreshTokenValue === "string" && refreshTokenValue ? refreshTokenValue : undefined;
      if (!refreshToken && existing) {
        try {
          const previous: unknown = JSON.parse(
            (await import("@/lib/secrets")).decryptSecret(existing.credentialsCiphertext, `${oauthState.organizationId}:slack`),
          );
          if (previous && typeof previous === "object" && "refreshToken" in previous
            && typeof previous.refreshToken === "string") refreshToken = previous.refreshToken;
        } catch {
          throw new Error("The stored Slack connection is invalid.");
        }
      }

      if (!existing) {
        const subscription = await transaction.billingSubscription.findUnique({
          where: { organizationId: oauthState.organizationId },
          select: { plan: true, status: true, currentPeriodEnd: true },
        });
        const limit = PLAN_LIMITS[resolveEntitledPlan(subscription)].integrations;
        const used = await transaction.integrationConnection.count({ where: { organizationId: oauthState.organizationId } });
        if (used >= limit) return false;
      }

      const credentialsCiphertext = encryptSecret(JSON.stringify({
        accessToken: tokenData.access_token,
        ...(refreshToken ? { refreshToken } : {}),
        ...(typeof expiresIn === "number" ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
        scope: tokenData.scope,
        teamId,
        teamName,
        botUserId: "bot_user_id" in tokenData && typeof tokenData.bot_user_id === "string" ? tokenData.bot_user_id : null,
      }), `${oauthState.organizationId}:slack`);

      if (existing) {
        await transaction.integrationConnection.updateMany({
          where: { id: existing.id, organizationId: oauthState.organizationId, provider: "slack" },
          data: { credentialsCiphertext },
        });
      } else {
        await transaction.integrationConnection.create({
          data: { organizationId: oauthState.organizationId, provider: "slack", name: connectionName, credentialsCiphertext },
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
