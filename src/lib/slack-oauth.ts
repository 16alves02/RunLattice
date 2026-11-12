import { createHash, randomBytes } from "node:crypto";

export function createSlackOAuthState() {
  const state = randomBytes(32).toString("base64url");
  return { state, stateHash: createHash("sha256").update(state).digest("hex") };
}

export function hashSlackOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
