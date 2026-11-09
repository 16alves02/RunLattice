import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import type { LookupFunction } from "node:net";

export const MAX_HTTP_REQUEST_BYTES = 64 * 1024;
export const MAX_HTTP_RESPONSE_BYTES = 1024 * 1024;
export const HTTP_ACTION_TIMEOUT_MS = 10_000;

export type ResolvedPublicAddress = { address: string; family: 4 | 6 };

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function inIpv4Range(address: number, base: string, prefix: number) {
  const network = ipv4ToNumber(base);
  if (network === null) return true;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (network & mask);
}

function ipv6ToBigInt(address: string): bigint | null {
  if (address.includes(".")) return null;
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8) return null;
  return groups.reduce((value, part) => (value << 16n) | BigInt(parseInt(part, 16)), 0n);
}

function inIpv6Range(address: bigint, base: string, prefix: number) {
  const network = ipv6ToBigInt(base);
  if (network === null) return true;
  const shift = BigInt(128 - prefix);
  return (address >> shift) === (network >> shift);
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address);
    if (value === null) return false;
    const denied: Array<[string, number]> = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
      ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
      ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return !denied.some(([base, prefix]) => inIpv4Range(value, base, prefix));
  }
  if (family === 6) {
    const value = ipv6ToBigInt(address);
    if (value === null) return false;
    // Only global-unicast 2000::/3 is accepted. Special-use and transition
    // ranges are excluded even when an OS resolver reports them as global.
    return inIpv6Range(value, "2000::", 3)
      && !inIpv6Range(value, "2001::", 23)
      && !inIpv6Range(value, "2002::", 16);
  }
  return false;
}

export function validateOutboundHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("HTTP actions require a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password
    || (url.port && url.port !== "443") || url.hash) {
    throw new Error("Only HTTPS destinations on the standard port are allowed.");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")
    || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) {
    throw new Error("Local and internal network destinations are blocked.");
  }
  if (isIP(url.hostname) && !isPublicIpAddress(url.hostname)) {
    throw new Error("Private, reserved and non-public IP destinations are blocked.");
  }
  return url;
}

export async function resolvePublicHttpsTarget(
  url: URL,
  resolver: typeof lookup = lookup,
): Promise<ResolvedPublicAddress> {
  const records = await resolver(url.hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => !isPublicIpAddress(record.address))) {
    throw new Error("The destination resolves to a private, reserved or non-public IP address.");
  }
  const selected = records[0];
  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw new Error("The destination did not resolve to a supported IP address.");
  }
  return { address: selected.address, family: selected.family };
}

export interface SafeHttpRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

export interface SafeHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const allowedHeaders = new Set(["accept", "content-type", "authorization", "x-api-key"]);

function validateHeaders(headers: Record<string, string> = {}) {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (!allowedHeaders.has(normalized) || /[\r\n]/.test(value) || value.length > 4_096) {
      throw new Error(`HTTP header "${name}" is not allowed or is invalid.`);
    }
    result[normalized] = value;
  }
  return result;
}

/**
 * Performs a single HTTPS request. DNS answers are checked in full and the
 * selected public IP is pinned into the TLS request's lookup callback.
 * Redirects are never followed. Response and request bodies are bounded.
 */
export async function requestPublicHttps(input: SafeHttpRequest): Promise<SafeHttpResponse> {
  const url = validateOutboundHttpsUrl(input.url);
  const body = input.body ?? "";
  if (Buffer.byteLength(body, "utf8") > MAX_HTTP_REQUEST_BYTES) {
    throw new Error("HTTP action request body exceeds the 64 KB limit.");
  }
  const headers = validateHeaders(input.headers);
  if (body && !headers["content-type"]) headers["content-type"] = "application/json";

  const target = await resolvePublicHttpsTarget(url);
  const pinnedLookup = ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
    callback(null, target.address, target.family);
  }) as unknown as LookupFunction;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = https.request(url, {
      method: input.method,
      headers: { ...headers, ...(body ? { "content-length": String(Buffer.byteLength(body, "utf8")) } : {}) },
      lookup: pinnedLookup,
      servername: url.hostname,
      timeout: HTTP_ACTION_TIMEOUT_MS,
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.destroy();
        finishReject(new Error("HTTP action redirects are blocked for security."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.byteLength;
        if (bytes > MAX_HTTP_RESPONSE_BYTES) {
          response.destroy(new Error("HTTP action response exceeds the 1 MB limit."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("error", (error) => finishReject(error));
      response.on("end", () => {
        if (settled) return;
        settled = true;
        const responseHeaders: Record<string, string> = {};
        for (const [name, value] of Object.entries(response.headers)) {
          if (typeof value === "string") responseHeaders[name] = value;
          else if (Array.isArray(value)) responseHeaders[name] = value.join(", ");
        }
        resolve({ status, headers: responseHeaders, body: Buffer.concat(chunks).toString("utf8") });
      });
    });

    request.on("error", (error) => finishReject(error));
    request.setTimeout(HTTP_ACTION_TIMEOUT_MS, () => request.destroy(new Error("HTTP action timed out after 10 seconds.")));
    if (body) request.write(body);
    request.end();
  });
}
