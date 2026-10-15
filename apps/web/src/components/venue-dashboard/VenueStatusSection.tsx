"use client";

import type { OwnerVenueStatus, VenueDisplayStatus } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import ReasonNote from "@/components/admin/ReasonNote";
import StatusBadge from "@/components/admin/StatusBadge";
import { STATUS_META } from "@/lib/venueStatus";

import type { VenueDetailsMode } from "./VenueDetailsModal";

interface VenueStatusSectionProps {
  status: OwnerVenueStatus | null;
  onEditDetails: (mode: VenueDetailsMode) => void;
}

// Where the owner's venue stands in the admin's review, and what to do next.
// Renders nothing for an approved, non-suspended venue (nothing to say) and
// until loaded. Suspension is a flag on top of the review status, so it wins.
// Reads the venue row directly (single source of truth), not the one-off
// "Notices from Admin" messages.
export default function VenueStatusSection({ status, onEditDetails }: VenueStatusSectionProps) {
  if (!status || (status.review_status === "approved" && !status.is_suspended)) {
    return null;
  }

  const kind: VenueDisplayStatus = status.is_suspended ? "suspended" : status.review_status;
  const { color } = STATUS_META[kind];

  return (
    <section className="mt-8 px-4 md:px-6">
      <div className="glass-panel relative overflow-hidden rounded-2xl py-5 pl-6 pr-5">
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />

        <StatusBadge status={kind} />

        {kind === "pending" ? (
          <>
            <h2 className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              Your venue is under review
            </h2>
            <p className="mt-1 font-[family-name:var(--font-cormorant)] text-lg italic text-zinc-300">
              The team will look it over and the result will appear right here.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              You can add shows as soon as it&apos;s approved. Until then it stays off /venues.
            </p>
            <div className="mt-3">
              <CtaButton type="button" className="min-h-[44px]" onClick={() => onEditDetails("edit")}>
                Edit details
              </CtaButton>
            </div>
          </>
        ) : null}

        {kind === "changes_requested" ? (
          <>
            <h2 className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              A few changes first
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              The team needs the following fixed before your venue can go live. Update it and send it
              back. You can&apos;t add shows in the meantime.
            </p>
            <ReasonNote reason={status.review_reason} color={color} caption="From the team" className="mt-4" />
            <div className="mt-4">
              <CtaButton type="button" className="min-h-[44px]" onClick={() => onEditDetails("resubmit")}>
                Fix and resubmit
              </CtaButton>
            </div>
          </>
        ) : null}

        {kind === "suspended" ? (
          <>
            <h2 className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              Your venue is suspended
            </h2>
            <ReasonNote reason={status.suspension_reason} color={color} caption="From the team" className="mt-3" />
            <p className="mt-3 text-sm text-zinc-400">
              Your venue is off /venues, your upcoming shows and their requests were cancelled, and you
              can&apos;t add shows. If the suspension is lifted, those shows won&apos;t come back: you&apos;ll
              add new ones. Questions?{" "}
              <a href="/support#contact" className="text-[#38bdf8] underline underline-offset-2 hover:text-[#7dd3fc]">
                Contact support
              </a>
              .
            </p>
          </>
        ) : null}

        {kind === "rejected" ? (
          <>
            <h2 className="mt-3 font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              Your venue wasn&apos;t approved
            </h2>
            <ReasonNote reason={status.review_reason} color={color} caption="From the team" className="mt-3" />
            <p className="mt-3 text-sm text-zinc-400">
              This decision is final and shows can&apos;t be added. If you think something is wrong,{" "}
              <a href="/support#contact" className="text-[#38bdf8] underline underline-offset-2 hover:text-[#7dd3fc]">
                contact support
              </a>
              .
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
