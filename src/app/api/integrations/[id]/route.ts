import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";
import { decryptSecret } from "@/lib/secrets";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const access = await getRequestWorkspace(request);
  if (access.response) return access.response;
  if (!canManageWorkspace(access.context.role)) {
    return NextResponse.json({ error: "Workspace administrator permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const connection = await prisma.integrationConnection.findFirst({
      where: { id, organizationId: access.context.organizationId },
      select: { id: true, provider: true, credentialsCiphertext: true },
    });
    if (!connection) return NextResponse.json({ error: "Integration connection not found." }, { status: 404 });

    if (connection.provider === "google") {
      let refreshToken: string;
      try {
        const credentials: unknown = JSON.parse(decryptSecret(
          connection.credentialsCiphertext,
          `${access.context.organizationId}:google`,
        ));
        if (!credentials || typeof credentials !== "object" || !("refreshToken" in credentials)
          || typeof credentials.refreshToken !== "string" || !credentials.refreshToken) {
          throw new Error("Invalid Google refresh token.");
        }
        refreshToken = credentials.refreshToken;
      } catch {
        return NextResponse.json({ error: "The Google connection could not be decrypted. It was not removed." }, { status: 503 });
      }

      let revoked: Response;
      try {
        revoked = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        return NextResponse.json({ error: "Google token revocation could not be confirmed. The connection remains saved; try again or revoke RunLattice access from your Google Account." }, { status: 503 });
      }
      if (!revoked.ok) {
        return NextResponse.json({ error: "Google rejected token revocation. The connection remains saved; revoke RunLattice access from your Google Account before retrying." }, { status: 503 });
      }
    }

    if (connection.provider === "slack") {
      const clientId = process.env.SLACK_CLIENT_ID;
      const clientSecret = process.env.SLACK_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "Slack app credentials are missing. The connection was not removed." }, { status: 503 });
      }
      let credentials: unknown;
      try {
        credentials = JSON.parse(decryptSecret(connection.credentialsCiphertext, `${access.context.organizationId}:slack`));
      } catch {
        return NextResponse.json({ error: "The Slack connection could not be decrypted. It was not removed." }, { status: 503 });
      }
      if (!credentials || typeof credentials !== "object"
        || !("accessToken" in credentials) || typeof credentials.accessToken !== "string" || !credentials.accessToken) {
        return NextResponse.json({ error: "The stored Slack credentials are invalid. The connection was not removed." }, { status: 503 });
      }

      let accessToken = credentials.accessToken;
      const expiresAt = "expiresAt" in credentials && typeof credentials.expiresAt === "string"
        ? Date.parse(credentials.expiresAt) : Number.POSITIVE_INFINITY;
      if (!Number.isFinite(expiresAt) && expiresAt !== Number.POSITIVE_INFINITY) {
        return NextResponse.json({ error: "The stored Slack token expiry is invalid. The connection was not removed." }, { status: 503 });
      }
      if (expiresAt <= Date.now() + 60_000) {
        if (!("refreshToken" in credentials) || typeof credentials.refreshToken !== "string" || !credentials.refreshToken) {
          return NextResponse.json({ error: "The Slack token has expired. Reconnect the workspace or uninstall RunLattice from Slack before removing this connection." }, { status: 503 });
        }
        let refreshedResponse: Response;
        try {
          refreshedResponse = await fetch("https://slack.com/api/oauth.v2.access", {
            method: "POST",
            headers: {
              authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credentials.refreshToken }),
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          });
        } catch {
          return NextResponse.json({ error: "Slack token refresh could not be confirmed. The connection remains saved." }, { status: 503 });
        }
        const refreshed: unknown = refreshedResponse.ok ? await refreshedResponse.json() : null;
        if (!refreshed || typeof refreshed !== "object" || !("ok" in refreshed) || refreshed.ok !== true
          || !("access_token" in refreshed) || typeof refreshed.access_token !== "string" || !refreshed.access_token
          || !("expires_in" in refreshed) || typeof refreshed.expires_in !== "number"
          || refreshed.expires_in < 60 || refreshed.expires_in > 86_400
          || !("refresh_token" in refreshed) || typeof refreshed.refresh_token !== "string" || !refreshed.refresh_token) {
          return NextResponse.json({ error: "Slack token refresh failed. The connection remains saved; reconnect the workspace or remove the app in Slack." }, { status: 503 });
        }
        accessToken = refreshed.access_token;
        const refreshedCredentials = {
          ...credentials,
          accessToken,
          refreshToken: refreshed.refresh_token,
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        };
        await prisma.integrationConnection.updateMany({
          where: { id: connection.id, organizationId: access.context.organizationId, provider: "slack", credentialsCiphertext: connection.credentialsCiphertext },
          data: { credentialsCiphertext: encryptSecret(JSON.stringify(refreshedCredentials), `${access.context.organizationId}:slack`) },
        });
      }

      let uninstallResponse: Response;
      try {
        uninstallResponse = await fetch("https://slack.com/api/apps.uninstall", {
          method: "POST",
          headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return NextResponse.json({ error: "Slack app removal could not be confirmed. The connection remains saved." }, { status: 503 });
      }
      const uninstallResult: unknown = uninstallResponse.ok ? await uninstallResponse.json() : null;
      if (!uninstallResult || typeof uninstallResult !== "object" || !("ok" in uninstallResult) || uninstallResult.ok !== true) {
        return NextResponse.json({ error: "Slack did not confirm app removal. The connection remains saved; remove RunLattice from your Slack workspace settings if necessary." }, { status: 503 });
      }
    }

    const result = await prisma.integrationConnection.deleteMany({
      where: { id, organizationId: access.context.organizationId },
    });
    if (result.count === 0) return NextResponse.json({ error: "Integration connection not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to remove integration connection:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The integration connection could not be removed." }, { status: 503 });
  }
}
