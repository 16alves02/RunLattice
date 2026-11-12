export function buildSlackMessagePayload(channel: string, message: string) {
  const normalizedChannel = channel.trim();
  if (!/^[CDG][A-Z0-9]{8,39}$/.test(normalizedChannel)) {
    throw new Error("Enter a valid Slack channel ID, such as C0123456789.");
  }
  if (!message.trim() || message.length > 40_000) {
    throw new Error("The Slack message must contain between 1 and 40,000 characters.");
  }
  return { channel: normalizedChannel, text: message, unfurl_links: false, unfurl_media: false };
}

export function parseSlackMessageResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true
    || !("channel" in payload) || typeof payload.channel !== "string"
    || !("ts" in payload) || typeof payload.ts !== "string" || !/^\d{10}\.\d{6}$/.test(payload.ts)) {
    const reason = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error : "invalid_response";
    throw new Error(`Slack could not post the message (${reason}). Check that the app is a member of the selected channel.`);
  }
  return { channel: payload.channel, ts: payload.ts };
}
