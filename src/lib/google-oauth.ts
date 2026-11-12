import { createHash, randomBytes } from "node:crypto";

export function createGoogleOAuthProof() {
  const state = randomBytes(32).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, stateHash, verifier, challenge };
}

export function hashGoogleOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
