import type { AdminManagedVenue } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import { STATUS_META, formatWaiting } from "@/lib/venueStatus";

import ReasonNote from "./ReasonNote";
import type { ReviewActionKind } from "./ReviewActionModal";
import StatusBadge from "./StatusBadge";

interface VenueReviewCardProps {
  venue: AdminManagedVenue;
  onAction: (kind: ReviewActionKind) => void;
  /** True right after a successful action: the card fades out before the list refreshes. */
  leaving?: boolean;
}

// A venue waiting in the review queue, with its three possible outcomes.
export default function VenueReviewCard({ venue, onAction, leaving = false }: VenueReviewCardProps) {
  const { color } = STATUS_META.pending;

  return (
    <div
      className={`glass-panel relative overflow-hidden rounded-2xl py-4 pl-5 pr-4 motion-safe:transition-all motion-safe:duration-200 ${
        leaving ? "pointer-events-none scale-[0.98] opacity-0" : "opacity-100"
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-white">{venue.name}</p>
          <p className="mt-0.5 text-sm text-zinc-400">{venue.city}</p>
        </div>
        <StatusBadge status="pending" className="shrink-0" />
      </div>

      <p className="mt-2 truncate text-[11px] uppercase tracking-wide text-zinc-500">
        {venue.owner_name ?? "Unknown owner"}
        {venue.owner_email ? <> &middot; {venue.owner_email}</> : null}
      </p>
      <p className="mt-0.5 font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.12em] text-zinc-400">
        Waiting {formatWaiting(venue.submitted_at)}
      </p>

      <ReasonNote reason={venue.review_reason} color={color} caption="Back in the queue · earlier note" className="mt-3" />

      <div className="mt-4 flex flex-col gap-1 border-t border-dashed border-white/15 pt-3 sm:flex-row sm:flex-wrap sm:gap-x-5">
        <CtaButton type="button" className="min-h-[44px] justify-center sm:justify-start" onClick={() => onAction("approve")}>
          Approve
        </CtaButton>
        <CtaButton
          type="button"
          className="min-h-[44px] justify-center sm:justify-start"
          onClick={() => onAction("request_changes")}
        >
          Request changes
        </CtaButton>
        <CtaButton
          type="button"
          variant="danger"
          className="min-h-[44px] justify-center sm:justify-start"
          onClick={() => onAction("reject")}
        >
          Reject
        </CtaButton>
      </div>
    </div>
  );
}
