import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
});

describe("integration credential encryption", () => {
  it("encrypts and decrypts secrets without storing plaintext", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const secret = "discord-webhook-secret";
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("uses a unique nonce for each encryption", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(encryptSecret("same-secret")).not.toBe(encryptSecret("same-secret"));
  });

  it("rejects an invalid encryption key", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");
    expect(() => encryptSecret("secret")).toThrow(/32-byte key/);
  });

  it("rejects tampered ciphertext", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("secret");
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].slice(0, -1)}A`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});
