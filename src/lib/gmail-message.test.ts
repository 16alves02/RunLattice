import { describe, expect, it } from "vitest";
import { buildGmailRawMessage } from "@/lib/gmail-message";

describe("Gmail message encoding", () => {
  it("encodes plain-text messages and UTF-8 subjects as Gmail base64url", () => {
    const raw = buildGmailRawMessage("person@example.com", "Olá, mundo", "A sua encomenda está pronta.");
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: person@example.com");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
    expect(decoded).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(decoded).toContain(Buffer.from("A sua encomenda está pronta.", "utf8").toString("base64"));
  });

  it("accepts up to twenty valid recipients", () => {
    expect(() => buildGmailRawMessage(Array.from({ length: 20 }, (_, i) => `user${i}@example.com`).join(", "), "Update", "Body")).not.toThrow();
    expect(() => buildGmailRawMessage(Array.from({ length: 21 }, (_, i) => `user${i}@example.com`).join(", "), "Update", "Body")).toThrow(/20 valid/);
  });

  it("rejects invalid recipients and header injection", () => {
    expect(() => buildGmailRawMessage("not-an-email", "Update", "Body")).toThrow(/valid comma-separated/);
    expect(() => buildGmailRawMessage("person@example.com", "Hello\r\nBcc: attacker@example.com", "Body")).toThrow(/line breaks/);
  });

  it("rejects empty or oversized message content", () => {
    expect(() => buildGmailRawMessage("person@example.com", " ", "Body")).toThrow(/subject/);
    expect(() => buildGmailRawMessage("person@example.com", "Subject", " ")).toThrow(/body/);
    expect(() => buildGmailRawMessage("person@example.com", "Subject", "x".repeat(100_001))).toThrow(/too long/);
  });
});
