import { createSlackOAuthState } from "@/lib/slack-oauth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

function getSlackOAuthConfig() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (!clientId || !redirectUri || !appUrl) return null;
  try {
    const callback = new URL(redirectUri);
    const application = new URL(appUrl);
    if (callback.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
    if (callback.origin !== application.origin || callback.pathname !== "/api/integrations/slack/callback"
      || callback.username || callback.password || callback.search || callback.hash) return null;
  } catch {
    return null;
  }
  return { clientId, redirectUri };
}

export async function GET(request: Request) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const config = getSlackOAuthConfig();
  if (!config || !process.env.SLACK_CLIENT_SECRET) {
    return NextResponse.json({ error: "Slack OAuth is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET and SLACK_REDIRECT_URI." }, { status: 503 });
  }

  try {
    const now = new Date();
    await prisma.slackOAuthState.deleteMany({ where: { expiresAt: { lt: now } } });
    const pendingStates = await prisma.slackOAuthState.count({
      where: {
        userId: access.context.userId,
        organizationId: access.context.organizationId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (pendingStates >= 5) {
      return NextResponse.json({ error: "Too many Slack authorization attempts are already pending. Finish or wait for an existing attempt to expire." }, { status: 429 });
    }

    const { state, stateHash } = createSlackOAuthState();
    await prisma.slackOAuthState.create({
      data: {
        stateHash,
        userId: access.context.userId,
        organizationId: access.context.organizationId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const authorization = new URL("https://slack.com/oauth/v2/authorize");
    authorization.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: "chat:write",
      state,
    }).toString();
    return NextResponse.redirect(authorization, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Unable to start Slack authorization." }, { status: 503 });
  }
}
