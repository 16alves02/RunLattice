const FORBIDDEN_RESPONSE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export type JsonScalar = string | number | boolean | null;

/**
 * Extracts one explicitly selected scalar from a JSON API response.
 * Complex objects and arrays are deliberately not persisted or forwarded.
 */
export function extractJsonResponseValue(body: string, path: string): JsonScalar {
  if (!path.trim() || path.length > 200) {
    throw new Error("A valid response JSON path is required.");
  }
  const segments = path.split(".");
  if (segments.some((segment) => !/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(segment)
    || FORBIDDEN_RESPONSE_PATH_SEGMENTS.has(segment))) {
    throw new Error("The response JSON path is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The external API response is not valid JSON.");
  }

  let value: unknown = parsed;
  for (const segment of segments) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || !Object.prototype.hasOwnProperty.call(value, segment)) {
      throw new Error("The configured response JSON path was not found.");
    }
    value = (value as Record<string, unknown>)[segment];
  }

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 2_000) return value;
  throw new Error("The selected response value must be a scalar of at most 2,000 characters.");
}
