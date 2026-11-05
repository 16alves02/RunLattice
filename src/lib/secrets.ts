import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const configuredKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!configuredKey) throw new Error("INTEGRATION_ENCRYPTION_KEY is required to store integration credentials.");

  const key = Buffer.from(configuredKey, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptSecret(value: string, context: string) {
  if (!value) throw new Error("A non-empty secret is required.");
  if (!context) throw new Error("An encryption context is required.");

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, context: string) {
  if (!context) throw new Error("A decryption context is required.");
  const [version, encodedIv, encodedTag, encodedData, ...extra] = payload.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedData || extra.length > 0) {
    throw new Error("The stored integration credential has an unsupported format.");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const encrypted = Buffer.from(encodedData, "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("The stored integration credential is invalid.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
