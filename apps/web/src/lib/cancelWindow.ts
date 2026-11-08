// Wording and checks for the cancellation window (migration 029): how many
// whole hours before a show starts a comedian may still cancel an ACCEPTED
// spot. The venue sets it (0 to 12, default 12) and it is copied onto each
// request when it is accepted. Pure functions only, so they are easy to test.
// The server is always the authority: these only decide what to SHOW.

export const CANCEL_CUTOFF_MIN_HOURS = 0;
export const CANCEL_CUTOFF_MAX_HOURS = 12;
export const CANCEL_CUTOFF_DEFAULT_HOURS = 12;

/** "up to 12 hours before the show starts", "up to 1 hour before…", "until the show starts". */
export function describeCutoff(hours: number): string {
  if (hours <= 0) return "until the show starts";
  if (hours === 1) return "up to 1 hour before the show starts";
  return `up to ${hours} hours before the show starts`;
}

/** Compact form for a spot card, read after "Cancel": "up to 12 h before start", "until the show starts". */
export function shortCutoff(hours: number): string {
  if (hours <= 0) return "until the show starts";
  return `up to ${hours} h before start`;
}

const IST_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  day: "numeric",
  month: "short",
});

/**
 * An ISO instant shown in India time, the same zone the server's own
 * messages use, whatever the browser's locale: "7:30 PM on 8 Nov".
 * Returns "" for anything that is not a valid instant.
 */
export function formatIstInstant(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const parts: Record<string, string> = {};
  for (const p of IST_PARTS.formatToParts(new Date(ms))) {
    parts[p.type] = p.value;
  }
  return `${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()} on ${parts.day} ${parts.month}`;
}

/**
 * True once the cancel-by instant has passed. An unknown or invalid instant is
 * "not closed" on purpose: the button stays and the server decides.
 */
export function isCancelClosed(cancelBy: string | null | undefined, nowMs: number): boolean {
  if (!cancelBy) return false;
  const ms = Date.parse(cancelBy);
  if (Number.isNaN(ms)) return false;
  return nowMs > ms;
}

/**
 * Paise to a display price: 0 is "Free", 15000 is "₹150", 1050 is "₹10.50".
 * null (no lock, or an invalid price that billing will not charge) is null so
 * the caller can show nothing.
 */
export function formatPaise(paise: number | null | undefined): string | null {
  if (paise === null || paise === undefined || !Number.isFinite(paise) || paise < 0) return null;
  if (paise === 0) return "Free";
  const rupees = paise / 100;
  // Whole rupees print without decimals, anything else with exactly two.
  const digits = paise % 100 === 0 ? 0 : 2;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
