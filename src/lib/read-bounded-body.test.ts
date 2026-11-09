import { describe, expect, it, vi } from "vitest";
import { readBoundedRequestBody } from "@/lib/read-bounded-body";

describe("bounded request body reader", () => {
  it("reads a body within the byte limit", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    await expect(readBoundedRequestBody(request, 32)).resolves.toEqual({
      ok: true,
      body: '{"ok":true}',
    });
  });

  it("rejects an oversized Content-Length before consuming the stream", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("too large"));
      },
      cancel,
    });
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-length": "100" },
      body: stream,
      // Node's Request implementation requires duplex for streamed request bodies.
      duplex: "half",
    } as RequestInit);

    await expect(readBoundedRequestBody(request, 8)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("stops reading and cancels a stream that exceeds the limit", async () => {
    const cancel = vi.fn();
    let emitted = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        emitted += 1;
        controller.enqueue(new Uint8Array(4));
        if (emitted === 3) controller.close();
      },
      cancel,
    });
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    await expect(readBoundedRequestBody(request, 8)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(cancel).toHaveBeenCalled();
    expect(emitted).toBeLessThanOrEqual(3);
  });

  it("rejects malformed UTF-8", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28]),
    });

    await expect(readBoundedRequestBody(request, 8)).resolves.toEqual({
      ok: false,
      reason: "invalid_utf8",
    });
  });

  it("accepts an empty body", async () => {
    const request = new Request("http://localhost/test", { method: "POST" });
    await expect(readBoundedRequestBody(request, 0)).resolves.toEqual({
      ok: true,
      body: "",
    });
  });
});
