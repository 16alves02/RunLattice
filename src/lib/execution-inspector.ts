const SENSITIVE_KEY = /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|cookie|credential)/i;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

/** Redacts common credential fields before execution data is shown in the UI. */
export function redactExecutionData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExecutionData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactExecutionData(nested),
      ]),
    );
  }
  if (typeof value === "string") return value.replace(BEARER_TOKEN, "Bearer [REDACTED]");
  return value;
}

export function formatExecutionData(value: unknown, maximumLength = 12_000): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(redactExecutionData(value), null, 2);
  } catch {
    return "Execution data could not be displayed.";
  }
  if (typeof serialized !== "string") return "No data recorded.";
  if (serialized.length <= maximumLength) return serialized;
  return `${serialized.slice(0, maximumLength)}\n… Output truncated for display.`;
}
