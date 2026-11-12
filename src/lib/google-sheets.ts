export type GoogleSheetsCell = string | number | boolean;

export function parseGoogleSheetsAppendValues(renderedJson: string): GoogleSheetsCell[][] {
  let value: unknown;
  try { value = JSON.parse(renderedJson); }
  catch { throw new Error("Google Sheets rows must be valid JSON after workflow mappings are resolved."); }

  if (!Array.isArray(value) || value.length < 1 || value.length > 1_000
    || value.some((row) => !Array.isArray(row) || row.length < 1 || row.length > 100
      || row.some((cell) => !["string", "number", "boolean"].includes(typeof cell)
        || (typeof cell === "number" && !Number.isFinite(cell))
        || (typeof cell === "string" && cell.length > 10_000)))) {
    throw new Error("Google Sheets rows must be a two-dimensional array containing 1-1,000 rows and 1-100 scalar cells per row.");
  }

  const cellCount = value.reduce((total: number, row: GoogleSheetsCell[]) => total + row.length, 0);
  if (cellCount > 10_000) throw new Error("Google Sheets append is limited to 10,000 cells per execution.");
  return value as GoogleSheetsCell[][];
}

export function parseGoogleSheetsReadResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Google Sheets returned an invalid read response.");
  if (!("values" in payload)) return { rowCount: 0, values: [] as GoogleSheetsCell[][] };
  const values = payload.values;
  if (!Array.isArray(values) || values.length > 1_000
    || values.some((row) => !Array.isArray(row) || row.length > 100
      || row.some((cell) => !["string", "number", "boolean"].includes(typeof cell)
        || (typeof cell === "number" && !Number.isFinite(cell))
        || (typeof cell === "string" && cell.length > 10_000)))) {
    throw new Error("Google Sheets returned an unsupported or oversized cell range.");
  }
  const cellCount = values.reduce((total, row) => total + row.length, 0);
  if (cellCount > 10_000) throw new Error("Google Sheets reads are limited to 10,000 cells per execution.");
  return { rowCount: values.length, values: values as GoogleSheetsCell[][] };
}

export function parseGoogleSheetsAppendResponse(payload: unknown) {
  const updates = payload && typeof payload === "object" && "updates" in payload ? payload.updates : undefined;
  if (!updates || typeof updates !== "object" || !("updatedRange" in updates)
    || typeof updates.updatedRange !== "string" || !("updatedRows" in updates)
    || typeof updates.updatedRows !== "number" || !Number.isInteger(updates.updatedRows)
    || updates.updatedRows < 0 || updates.updatedRows > 1_000) {
    throw new Error("Google Sheets returned an invalid append confirmation.");
  }
  return { updatedRange: updates.updatedRange, updatedRows: updates.updatedRows };
}

export async function readGoogleSheetsJsonResponse(response: Response, maximumBytes = 2_000_000): Promise<unknown> {
  if (!response.body) throw new Error("Google Sheets returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new Error("Google Sheets response exceeded the 2 MB execution limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8")) as unknown;
  } catch {
    throw new Error("Google Sheets returned invalid JSON.");
  }
}
