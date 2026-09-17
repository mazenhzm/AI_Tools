export interface JsonParseOk {
  ok: true;
  value: unknown;
}
export interface JsonParseFail {
  ok: false;
  error: string;
}

/**
 * Extracts and parses the first JSON object from a model response. Models
 * sometimes wrap JSON in markdown fences or add prose; we tolerate that but
 * never execute anything.
 */
export function parseJsonFromModel(text: string): JsonParseOk | JsonParseFail {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, error: "empty model response" };
  }
  const withoutFences = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "no JSON object found in model response" };
  }
  try {
    return { ok: true, value: JSON.parse(withoutFences.slice(start, end + 1)) };
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }
}
