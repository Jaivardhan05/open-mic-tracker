import type { AdminManagedVenue, VenueDisplayStatus } from "@repo/types";

// Suspended wins; hidden is the primary status only for an approved venue (a
// hidden pending/changes-requested/rejected venue keeps its review status so
// it never drops out of the review queue); otherwise the review status.
export function deriveDisplayStatus(
  venue: Pick<AdminManagedVenue, "review_status" | "is_hidden" | "is_suspended">
): VenueDisplayStatus {
  if (venue.is_suspended) return "suspended";
  if (venue.review_status === "approved" && venue.is_hidden) return "hidden";
  return venue.review_status;
}

// Flat colors only. Chosen to stay clear of the spot-type colors (busking
// pink, hosting yellow) and always paired with an icon + label, never color
// alone: pending is amber, approved green, changes-requested orange,
// rejected red, hidden zinc, suspended a red outline.
export const STATUS_META: Record<VenueDisplayStatus, { label: string; color: string }> = {
  pending: { label: "Pending review", color: "#fbbf24" },
  changes_requested: { label: "Changes requested", color: "#fb923c" },
  approved: { label: "Approved", color: "#4ade80" },
  hidden: { label: "Hidden", color: "#a1a1aa" },
  suspended: { label: "Suspended", color: "#ef4444" },
  rejected: { label: "Rejected", color: "#f87171" },
};

// Display order after "All": what needs attention first.
export const STATUS_ORDER: VenueDisplayStatus[] = [
  "pending",
  "changes_requested",
  "approved",
  "hidden",
  "suspended",
  "rejected",
];

// The admin's note that explains the venue's current display status, if any.
// Empty or missing reasons (e.g. a legacy rejection) return null so the UI
// shows the status alone.
export function statusReason(venue: AdminManagedVenue): string | null {
  const status = deriveDisplayStatus(venue);
  const raw =
    status === "suspended"
      ? venue.suspension_reason
      : status === "hidden"
        ? venue.hidden_reason
        : status === "changes_requested" || status === "rejected"
          ? venue.review_reason
          : null;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function formatWaiting(iso: string, now: number = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}
