"use client";

import { useMemo, useState } from "react";

import type { AdminManagedVenue } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import ReviewActionModal, { type ReviewActionKind } from "@/components/admin/ReviewActionModal";
import StatusSummaryStrip, { type StatusFilter } from "@/components/admin/StatusSummaryStrip";
import VenueListItem, { VENUE_ROW_GRID } from "@/components/admin/VenueListItem";
import VenueReviewCard from "@/components/admin/VenueReviewCard";
import { useToast } from "@/context/ToastContext";
import { useAdminVenueList } from "@/hooks/useAdminVenueList";
import { STATUS_META, deriveDisplayStatus } from "@/lib/venueStatus";

function SectionHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
        {children}
      </h2>
      {count !== undefined ? (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{count}</span>
      ) : null}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="glass-panel rounded-2xl px-4 py-6 text-center font-[family-name:var(--font-cormorant)] text-xl italic text-zinc-400">
      {children}
    </p>
  );
}

function PageSkeleton() {
  return (
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label="Loading venues">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`glass-panel h-[88px] rounded-2xl ${i === 0 ? "col-span-2" : ""}`} />
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-panel h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function AdminVenuesPage() {
  const { venues, isLoading, error, refetch, reviewVenue } = useAdminVenueList();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [action, setAction] = useState<{ kind: ReviewActionKind; venue: AdminManagedVenue } | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  async function handleConfirm(reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!action) return { success: false, error: "Nothing to confirm." };
    const { kind, venue } = action;

    const result = await reviewVenue(venue.id, kind, reason);
    if (!result.success) {
      // Most failures mean the venue moved on (another admin acted, or it was
      // changed in the database): resync the list, keep the modal and its error.
      void refetch();
      return result;
    }

    setAction(null);
    showToast(
      kind === "approve"
        ? `${venue.name} is approved and live.`
        : kind === "request_changes"
          ? `Changes requested from ${venue.name}.`
          : `${venue.name} was rejected.`
    );

    // Let the card fade out, then pull the fresh list.
    setLeavingId(venue.id);
    window.setTimeout(() => {
      void refetch().finally(() => setLeavingId(null));
    }, 220);

    return result;
  }

  const { counts, attention, others } = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: venues.length,
      pending: 0,
      changes_requested: 0,
      approved: 0,
      hidden: 0,
      suspended: 0,
      rejected: 0,
    };
    const attention: AdminManagedVenue[] = [];
    const others: AdminManagedVenue[] = [];

    for (const venue of venues) {
      const status = deriveDisplayStatus(venue);
      counts[status] += 1;
      if (status === "pending") {
        attention.push(venue);
      } else {
        others.push(venue);
      }
    }

    // Longest-waiting first.
    attention.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
    return { counts, attention, others };
  }, [venues]);

  const showAttention = filter === "all" || filter === "pending";
  const listed =
    filter === "all"
      ? others
      : filter === "pending"
        ? []
        : others.filter((v) => deriveDisplayStatus(v) === filter);
  const showList = filter !== "pending";

  return (
    <>
      <section className="px-4 pt-10 md:px-6">
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl uppercase tracking-[0.04em] text-white md:text-5xl">
          Venues
        </h1>
        <p className="mt-1 font-[family-name:var(--font-cormorant)] text-xl italic text-zinc-400">
          Every room on the circuit, and what needs you.
        </p>
      </section>

      <section className="px-4 md:px-6">
        {isLoading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="glass-panel mt-6 flex flex-col items-start gap-3 rounded-2xl p-5">
            <p className="text-sm text-red-400">{error}</p>
            <CtaButton type="button" onClick={() => void refetch()}>
              Try again
            </CtaButton>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <StatusSummaryStrip counts={counts} value={filter} onChange={setFilter} />
            </div>

            {showAttention ? (
              <div className="mt-8">
                <SectionHeading count={attention.length}>Needs your attention</SectionHeading>
                {attention.length === 0 ? (
                  <EmptyNote>Nothing waiting on you. The room is quiet.</EmptyNote>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {attention.map((venue) => (
                      <VenueReviewCard
                        key={venue.id}
                        venue={venue}
                        leaving={leavingId === venue.id}
                        onAction={(kind) => setAction({ kind, venue })}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {showList ? (
              <div className="mt-8">
                <SectionHeading count={listed.length}>
                  {filter === "all" ? "Everything else" : STATUS_META[filter].label}
                </SectionHeading>
                {venues.length === 0 ? (
                  <EmptyNote>No venues on the circuit yet.</EmptyNote>
                ) : listed.length === 0 ? (
                  <EmptyNote>
                    {filter === "all" ? "Nothing else on the circuit yet." : "No venues in this state."}
                  </EmptyNote>
                ) : (
                  <div className="glass-panel overflow-hidden rounded-2xl">
                    <div
                      className={`hidden border-b border-white/10 py-2 pl-5 pr-4 font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500 ${VENUE_ROW_GRID}`}
                    >
                      <span>Venue</span>
                      <span>Status</span>
                      <span>Owner</span>
                      <span className="text-right">Updated</span>
                    </div>
                    <ul className="divide-y divide-white/10">
                      {listed.map((venue) => (
                        <VenueListItem key={venue.id} venue={venue} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </section>

      {action ? (
        <ReviewActionModal
          kind={action.kind}
          venueName={action.venue.name}
          onConfirm={handleConfirm}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
