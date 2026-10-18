"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import CtaButton from "@/components/CtaButton";
import ReviewActionModal from "@/components/admin/ReviewActionModal";
import StatusBadge from "@/components/admin/StatusBadge";
import VenueNextActions from "@/components/admin/VenueNextActions";
import VenueProfilePanel from "@/components/admin/VenueProfilePanel";
import VenueSituationPanel from "@/components/admin/VenueSituationPanel";
import { IconChevronLeft } from "@/components/icons/NavIcons";
import { useToast } from "@/context/ToastContext";
import { useAdminVenue } from "@/hooks/useAdminVenue";
import { runVenueAction, type VenueActionKind } from "@/lib/adminVenueActions";
import { deriveDisplayStatus } from "@/lib/venueStatus";

const TOAST: Record<VenueActionKind, (name: string) => string> = {
  approve: (n) => `${n} is approved and live.`,
  request_changes: (n) => `Changes requested from ${n}.`,
  reject: (n) => `${n} was rejected.`,
  hide: (n) => `${n} is hidden.`,
  unhide: (n) => `${n} is no longer hidden.`,
  reopen: (n) => `${n} is back in the review queue.`,
};

function BackLink() {
  return (
    <Link
      href="/admin/venues"
      className="inline-flex min-h-[44px] items-center gap-1 text-sm text-zinc-400 hover:text-[#38bdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
    >
      <IconChevronLeft className="h-4 w-4" />
      All venues
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label="Loading venue">
      <div className="glass-panel h-24 rounded-2xl" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel h-40 rounded-2xl" />
        <div className="glass-panel h-40 rounded-2xl" />
      </div>
      <div className="glass-panel mt-4 h-72 rounded-2xl" />
    </div>
  );
}

export default function AdminVenuePage() {
  const params = useParams<{ id: string }>();
  const venueId = String(params.id);
  const { venue, isLoading, notFound, error, refetch } = useAdminVenue(venueId);
  const { showToast } = useToast();
  const [action, setAction] = useState<VenueActionKind | null>(null);

  async function handleConfirm(reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!action || !venue) return { success: false, error: "Nothing to confirm." };

    const result = await runVenueAction(venue.id, action, reason);
    if (!result.success) {
      // Most failures mean the venue moved on (another admin acted): resync,
      // keep the modal and its error so the admin sees why.
      void refetch();
      return result;
    }

    setAction(null);
    showToast(TOAST[action](venue.name));
    void refetch();
    return result;
  }

  return (
    <>
      <section className="px-4 pt-6 md:px-6">
        <BackLink />

        {isLoading ? (
          <PageSkeleton />
        ) : notFound ? (
          <div className="glass-panel mt-4 rounded-2xl p-6">
            <h1 className="font-[family-name:var(--font-bebas)] text-3xl uppercase tracking-[0.04em] text-white">
              Venue not found
            </h1>
            <p className="mt-1 font-[family-name:var(--font-cormorant)] text-xl italic text-zinc-400">
              It may have been removed, or the link is wrong.
            </p>
          </div>
        ) : error && !venue ? (
          <div className="glass-panel mt-4 flex flex-col items-start gap-3 rounded-2xl p-5">
            <p className="text-sm text-red-400">{error}</p>
            <CtaButton type="button" onClick={() => void refetch()}>
              Try again
            </CtaButton>
          </div>
        ) : venue ? (
          <>
            <header className="mt-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-white md:text-5xl">
                  {venue.name}
                </h1>
                <StatusBadge status={deriveDisplayStatus(venue)} />
              </div>
              <p className="mt-1 font-[family-name:var(--font-cormorant)] text-xl italic text-zinc-400">
                {venue.city}
                {" · "}
                {venue.owner_name ? (
                  <>
                    {venue.owner_name}
                    {venue.owner_email ? <span className="text-zinc-500"> ({venue.owner_email})</span> : null}
                  </>
                ) : (
                  "No owner on record"
                )}
              </p>
            </header>

            {error ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <VenueSituationPanel venue={venue} />
              <VenueNextActions venue={venue} onAction={setAction} />
            </div>

            <div className="mt-4">
              <VenueProfilePanel venue={venue} />
            </div>
          </>
        ) : null}
      </section>

      {action && venue ? (
        <ReviewActionModal
          kind={action}
          venueName={venue.name}
          onConfirm={handleConfirm}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
