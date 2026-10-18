import type { AdminVenueDetail } from "@repo/types";

import { STATUS_META, deriveDisplayStatus, statusReason } from "@/lib/venueStatus";

import ReasonNote from "./ReasonNote";
import StatusBadge from "./StatusBadge";
import StatusIcon from "./StatusIcons";

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// "since 12 Oct 2026, 4:05 pm · by Name". Missing parts are named, not guessed:
// a hide from before migration 026 has neither a time nor an admin recorded.
function sinceLine(label: string, at: string | null, by: string | null): string {
  const when = formatStamp(at);
  const parts = [when ? `${label} ${when}` : `${label}: time not recorded`];
  if (by) parts.push(`by ${by}`);
  return parts.join(" · ");
}

// Where the venue stands right now: its single display status, the admin's
// current note for it, and who/when. Only the current reason is kept by the
// database (there is no history yet), so this does not pretend to be a timeline.
export default function VenueSituationPanel({ venue }: { venue: AdminVenueDetail }) {
  const status = deriveDisplayStatus(venue);
  const { color } = STATUS_META[status];

  const primaryLine =
    status === "suspended"
      ? sinceLine("Suspended", venue.suspended_at, venue.suspended_by_name)
      : status === "hidden"
        ? sinceLine("Hidden", venue.hidden_at, venue.hidden_by_name)
        : status === "pending"
          ? sinceLine("In the queue since", venue.submitted_at, null)
          : sinceLine(
              status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Changes requested",
              venue.reviewed_at,
              venue.reviewed_by_name
            );

  // A hide that is not the primary status (a pending venue that is hidden, or a
  // suspended venue that is also hidden) is shown as its own flag.
  const alsoHidden = venue.is_hidden && status !== "hidden";

  return (
    <section className="glass-panel relative overflow-hidden rounded-2xl py-5 pl-6 pr-5" aria-labelledby="situation-heading">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
      <h2
        id="situation-heading"
        className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
      >
        Situation
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <p className="text-xs text-zinc-400">{primaryLine}</p>
      </div>

      <ReasonNote reason={statusReason(venue)} color={color} className="mt-4" />

      {alsoHidden ? (
        <div className="mt-5 border-t border-dashed border-white/15 pt-4">
          <p className="flex items-center gap-1.5 font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-400">
            <StatusIcon status="hidden" className="h-3.5 w-3.5" />
            Also hidden
          </p>
          <p className="mt-1 text-xs text-zinc-500">{sinceLine("Hidden", venue.hidden_at, venue.hidden_by_name)}</p>
          <ReasonNote reason={venue.hidden_reason} color={STATUS_META.hidden.color} className="mt-3" />
        </div>
      ) : null}

      <p className="mt-5 font-[family-name:var(--font-cormorant)] text-sm italic text-zinc-500">
        Only the current note is kept. There is no history of earlier decisions yet.
      </p>
    </section>
  );
}
