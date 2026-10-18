import type { AdminVenueDetail } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import type { VenueActionKind } from "@/lib/adminVenueActions";
import { deriveDisplayStatus } from "@/lib/venueStatus";

interface VenueNextActionsProps {
  venue: AdminVenueDetail;
  onAction: (kind: VenueActionKind) => void;
}

const BUTTON = "min-h-[44px] justify-center sm:justify-start";

// What the admin can do from here, by state:
//   pending            Approve / Request changes / Reject
//   changes requested  Approve / Reject (the owner is the one who has to act)
//   rejected           Move back to pending
//   approved           (Suspend arrives with step 6b)
//   suspended          nothing yet (Unsuspend arrives with step 6b)
// Hide / Unhide are offered in every state except suspended.
export default function VenueNextActions({ venue, onAction }: VenueNextActionsProps) {
  const status = deriveDisplayStatus(venue);
  const review = venue.review_status;
  const suspended = venue.is_suspended;

  const lead = suspended
    ? "Suspended. Hide and unhide are paused until the suspension is lifted."
    : review === "pending"
      ? "Waiting on you."
      : review === "changes_requested"
        ? "Waiting on the owner to fix and resubmit. You can still decide."
        : review === "rejected"
          ? "Rejected. The owner can't resubmit; you can reopen it."
          : status === "hidden"
            ? "Approved, but hidden from the public."
            : "Live.";

  return (
    <section className="glass-panel rounded-2xl p-5" aria-labelledby="actions-heading">
      <h2
        id="actions-heading"
        className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
      >
        Next actions
      </h2>
      <p className="mt-1 font-[family-name:var(--font-cormorant)] text-lg italic text-zinc-400">{lead}</p>

      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">
        {review === "pending" ? (
          <>
            <CtaButton type="button" className={BUTTON} onClick={() => onAction("approve")}>
              Approve
            </CtaButton>
            <CtaButton type="button" className={BUTTON} onClick={() => onAction("request_changes")}>
              Request changes
            </CtaButton>
            <CtaButton type="button" variant="danger" className={BUTTON} onClick={() => onAction("reject")}>
              Reject
            </CtaButton>
          </>
        ) : null}

        {review === "changes_requested" ? (
          <>
            <CtaButton type="button" className={BUTTON} onClick={() => onAction("approve")}>
              Approve
            </CtaButton>
            <CtaButton type="button" variant="danger" className={BUTTON} onClick={() => onAction("reject")}>
              Reject
            </CtaButton>
          </>
        ) : null}

        {review === "rejected" ? (
          <CtaButton type="button" className={BUTTON} onClick={() => onAction("reopen")}>
            Move back to pending
          </CtaButton>
        ) : null}

        {!suspended ? (
          venue.is_hidden ? (
            <CtaButton type="button" className={BUTTON} onClick={() => onAction("unhide")}>
              Unhide
            </CtaButton>
          ) : (
            <CtaButton type="button" className={BUTTON} onClick={() => onAction("hide")}>
              Hide
            </CtaButton>
          )
        ) : null}
      </div>
    </section>
  );
}
