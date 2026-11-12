import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { canManageWorkspace, getRequestWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return null;
  try {
    const callback = new URL(redirectUri);
    if (callback.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
    if (callback.username || callback.password || callback.search || callback.hash) return null;
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

  const config = getOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI." }, { status: 503 });
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google OAuth client secret is not configured." }, { status: 503 });
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.googleOAuthState.create({
      data: {
        stateHash,
        userId: access.context.userId,
        organizationId: access.context.organizationId,
        codeVerifierCiphertext: encryptSecret(verifier, `${access.context.organizationId}:google-oauth:${stateHash}`),
        expiresAt,
      },
    });

    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    return NextResponse.redirect(authorization, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Unable to start Google authorization. Check the integration encryption key." }, { status: 503 });
  }
}
