export type BoundedBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: "too_large" | "invalid_utf8" | "invalid_json" | "read_failed" };

/**
 * Reads a request body without buffering untrusted input beyond maxBytes.
 * Content-Length is only an early rejection hint; streamed bytes are counted too.
 */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("A non-negative safe request body limit is required.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { ok: false, reason: "read_failed" };
    if (Number(contentLength) > maxBytes) return { ok: false, reason: "too_large" };
  }

  if (!request.body) return { ok: true, body: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      try {
        body += decoder.decode(value, { stream: true });
      } catch {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "invalid_utf8" };
      }
    }
    try {
      body += decoder.decode();
    } catch {
      return { ok: false, reason: "invalid_utf8" };
    }
    return { ok: true, body };
  } catch { return { ok: false, reason: "read_failed" };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The stream may already have been cancelled or errored.
    }
  }
}

export async function readBoundedJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: BoundedBodyResult extends { ok: false; reason: infer R } ? R : never }> {
  const result = await readBoundedRequestBody(request, maxBytes);
  if (!result.ok) return result;
  try {
    return { ok: true, value: JSON.parse(result.body) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
