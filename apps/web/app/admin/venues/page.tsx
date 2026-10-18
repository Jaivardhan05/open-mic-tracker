"use client";

import { useEffect, useMemo, useState } from "react";

import type { AdminManagedVenue } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import ReviewActionModal, { type ReviewActionKind } from "@/components/admin/ReviewActionModal";
import StatusSummaryStrip, { type StatusFilter } from "@/components/admin/StatusSummaryStrip";
import VenueFilterBar from "@/components/admin/VenueFilterBar";
import VenueListItem, { VENUE_ROW_GRID } from "@/components/admin/VenueListItem";
import VenueReviewCard from "@/components/admin/VenueReviewCard";
import { useToast } from "@/context/ToastContext";
import { useAdminVenueList } from "@/hooks/useAdminVenueList";
import { STATUS_META, deriveDisplayStatus } from "@/lib/venueStatus";

const SEARCH_DEBOUNCE_MS = 250;

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
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [city, setCity] = useState("");
  const { venues, counts, cities, isLoading, isFetching, error, refetch, reviewVenue } = useAdminVenueList({
    q: debouncedQ,
    status: filter,
    city,
  });
  const { showToast } = useToast();
  const [action, setAction] = useState<{ kind: ReviewActionKind; venue: AdminManagedVenue } | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

  // A city that no longer exists in the data (e.g. its last venue was removed)
  // would filter to nothing with no way to see why: fall back to all cities.
  useEffect(() => {
    if (!isLoading && city !== "" && cities.length > 0 && !cities.includes(city)) setCity("");
  }, [isLoading, city, cities]);

  function clearFilters() {
    setSearch("");
    setDebouncedQ("");
    setCity("");
    setFilter("all");
  }

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

  // The API has already applied q, city and status; this only splits the
  // result into the review queue and everything else.
  const { attention, others } = useMemo(() => {
    const attention: AdminManagedVenue[] = [];
    const others: AdminManagedVenue[] = [];
    for (const venue of venues) {
      (deriveDisplayStatus(venue) === "pending" ? attention : others).push(venue);
    }
    // Longest-waiting first.
    attention.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
    return { attention, others };
  }, [venues]);

  const searching = debouncedQ !== "" || city !== "";
  const noVenuesAtAll = counts.all === 0 && !searching;
  const noMatches = counts.all === 0 && searching;
  const showAttention = filter === "all" || filter === "pending";
  const listed = others;
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
              <VenueFilterBar
                search={search}
                onSearchChange={setSearch}
                city={city}
                cities={cities}
                onCityChange={setCity}
              />
            </div>

            <div
              aria-busy={isFetching}
              className={isFetching ? "opacity-60 motion-safe:transition-opacity" : "motion-safe:transition-opacity"}
            >
            <div className="mt-6">
                <StatusSummaryStrip counts={counts} value={filter} onChange={setFilter} />
              </div>

              {noMatches ? (
                <div className="mt-8">
                  <EmptyNote>
                    No venues match
                    {debouncedQ !== "" ? ` \u201c${debouncedQ}\u201d` : ""}
                    {city !== "" ? ` in ${city}` : ""}.
                  </EmptyNote>
                  <div className="mt-3 flex justify-center">
                    <CtaButton type="button" onClick={clearFilters}>
                      Clear filters
                    </CtaButton>
                  </div>
                </div>
              ) : null}

              {!noMatches && showAttention ? (
                <div className="mt-8">
                  <SectionHeading count={attention.length}>Needs your attention</SectionHeading>
                  {attention.length === 0 ? (
                    <EmptyNote>
                      {searching ? "No pending venues match." : "Nothing waiting on you. The room is quiet."}
                    </EmptyNote>
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

              {!noMatches && showList ? (
                <div className="mt-8">
                  <SectionHeading count={listed.length}>
                    {filter === "all" ? "Everything else" : STATUS_META[filter].label}
                  </SectionHeading>
                  {noVenuesAtAll ? (
                    <EmptyNote>No venues on the circuit yet.</EmptyNote>
                  ) : listed.length === 0 ? (
                    <EmptyNote>
                      {searching
                        ? "No other venues match."
                        : filter === "all"
                          ? "Nothing else on the circuit yet."
                          : "No venues in this state."}
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
            </div>
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
