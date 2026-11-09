import { describe, expect, it, vi } from "vitest";
import {
  isPublicIpAddress,
  resolvePublicHttpsTarget,
  validateOutboundHttpsUrl,
} from "@/lib/safe-http";

describe("outbound HTTPS destination validation", () => {
  it("accepts HTTPS on the standard port", () => {
    expect(validateOutboundHttpsUrl("https://api.example.com/v1/events").hostname).toBe("api.example.com");
  });

  it.each([
    "http://api.example.com",
    "https://localhost",
    "https://service.local",
    "https://service.internal",
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://169.254.169.254",
    "https://192.168.1.10",
    "https://[::1]",
    "https://[fc00::1]",
    "https://api.example.com:8443",
    "https://user:pass@api.example.com",
  ])("rejects unsafe destination %s", (url) => {
    expect(() => validateOutboundHttpsUrl(url)).toThrow();
  });

  it("rejects URL fragments", () => {
    expect(() => validateOutboundHttpsUrl("https://api.example.com/path#secret")).toThrow();
  });
});

describe("public IP classification", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("accepts public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002::1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });
});

describe("DNS rebinding protection", () => {
  it("rejects a hostname if any DNS answer is non-public", async () => {
    const resolver = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]) as unknown as typeof import("node:dns/promises").lookup;

    await expect(resolvePublicHttpsTarget(new URL("https://api.example.com"), resolver))
      .rejects.toThrow(/private, reserved or non-public/);
  });

  it("returns one checked address for IP pinning", async () => {
    const resolver = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]) as unknown as typeof import("node:dns/promises").lookup;

    await expect(resolvePublicHttpsTarget(new URL("https://api.example.com"), resolver))
      .resolves.toEqual({ address: "93.184.216.34", family: 4 });
  });
  it("strips IPv6 URL brackets before resolving the hostname", async () => {
    const resolver = vi.fn(async () => [{ address: "2606:4700:4700::1111", family: 6 }])
      as unknown as typeof import("node:dns/promises").lookup;

    await expect(resolvePublicHttpsTarget(new URL("https://[2606:4700:4700::1111]"), resolver))
      .resolves.toEqual({ address: "2606:4700:4700::1111", family: 6 });
    expect(resolver).toHaveBeenCalledWith("2606:4700:4700::1111", { all: true, verbatim: true });
  });

});
