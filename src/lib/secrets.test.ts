import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;
const context = "org-1:discord";

afterEach(() => {
  if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
});

describe("integration credential encryption", () => {
  it("encrypts and decrypts secrets without storing plaintext", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const secret = "discord-webhook-secret";
    const encrypted = encryptSecret(secret, context);

    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, context)).toBe(secret);
  });

  it("uses a unique nonce for each encryption", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(encryptSecret("same-secret", context)).not.toBe(encryptSecret("same-secret", context));
  });

  it("rejects an invalid encryption key", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");
    expect(() => encryptSecret("secret", context)).toThrow(/32-byte key/);
  });

  it("rejects tampered ciphertext", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("secret", context);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    expect(() => decryptSecret(parts.join("."), context)).toThrow();
  });

  it("rejects credentials under a different workspace or provider context", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("secret", context);
    expect(() => decryptSecret(encrypted, "org-2:discord")).toThrow();
    expect(() => decryptSecret(encrypted, "org-1:slack")).toThrow();
  });
});
