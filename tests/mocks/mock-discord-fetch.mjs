const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  if (url.startsWith("https://discord.com/api/webhooks/")) {
    return new Response(null, { status: 204 });
  }

  return originalFetch(input, init);
};
