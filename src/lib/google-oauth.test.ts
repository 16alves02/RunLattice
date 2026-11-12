import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGoogleOAuthProof, hashGoogleOAuthState } from "@/lib/google-oauth";

describe("Google OAuth proof", () => {
  it("creates high-entropy state and a PKCE S256 challenge", () => {
    const proof = createGoogleOAuthProof();
    expect(Buffer.from(proof.state, "base64url")).toHaveLength(32);
    expect(Buffer.from(proof.verifier, "base64url")).toHaveLength(48);
    expect(proof.stateHash).toBe(hashGoogleOAuthState(proof.state));
    expect(proof.stateHash).not.toContain(proof.state);
    expect(proof.challenge).toBe(createHash("sha256").update(proof.verifier).digest("base64url"));
    expect(proof.challenge).not.toBe(proof.verifier);
  });

  it("produces a different state hash for a different state", () => {
    const proof = createGoogleOAuthProof();
    expect(hashGoogleOAuthState(`${proof.state}x`)).not.toBe(proof.stateHash);
  });
});
