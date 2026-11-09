const TEMPLATE_TOKEN = /\{\{\s*(input(?:\.[A-Za-z0-9_-]+)+)\s*\}\}/g;
const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Resolves simple input paths without evaluating JavaScript or expressions.
 * Only string, number and boolean values can be inserted into a message.
 */
export function renderInputTemplate(template: string, input: unknown, maxLength = 2_000, jsonEncodeValues = false): string {
  const rendered = template.replace(TEMPLATE_TOKEN, (_token, expression: string) => {
    const segments = expression.split(".").slice(1);
    if (segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) {
      throw new Error("The message template contains a forbidden input path.");
    }

    let value: unknown = input;
    for (const segment of segments) {
      if (!value || typeof value !== "object" || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, segment)) {
        throw new Error(`The message template input "${expression}" is unavailable.`);
      }
      value = (value as Record<string, unknown>)[segment];
    }

    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error(`The message template input "${expression}" must be a string, number or boolean.`);
    }
    return jsonEncodeValues ? JSON.stringify(value) : String(value);
  });

  if (rendered.length > maxLength) {
    throw new Error(`The rendered template exceeds the ${maxLength.toLocaleString("en-US")} character limit.`);
  }
  return rendered;
}
