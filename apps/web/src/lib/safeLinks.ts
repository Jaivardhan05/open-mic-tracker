// Saved profile links are untrusted user input. These helpers return a safe
// href or null (null = "not linked"); empty/whitespace values are treated as null.

/** Only http(s) URLs pass; javascript:, data:, etc. return null. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A single plain address becomes mailto:; anything that could smuggle ?cc=/?body= params returns null. */
export function safeMailto(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^[^\s@?&,;<>]+@[^\s@?&,;<>]+\.[^\s@?&,;<>]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}
