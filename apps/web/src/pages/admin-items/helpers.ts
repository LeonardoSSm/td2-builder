export function parseDetailEntries(raw: string) {
  const value = raw.trim();
  if (!value) return undefined;
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Detail entries must be a JSON array.");
  }
  return parsed;
}

export function parseOptionalInt(value: string, field: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${field} must be an integer >= 0.`);
  }
  return n;
}
