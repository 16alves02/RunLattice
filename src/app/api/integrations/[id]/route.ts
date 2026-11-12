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
