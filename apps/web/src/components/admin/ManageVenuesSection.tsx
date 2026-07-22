"use client";

import { useState } from "react";

import type { AdminVenue } from "@repo/types";

import { useAdminVenues } from "@/hooks/useAdminVenues";
import { matchesVenueSearch } from "@/lib/venueSearch";
import { IconClose, IconSearch } from "@/components/icons/NavIcons";

import HideVenueDialog from "./HideVenueDialog";
import VenueActionSheet from "./VenueActionSheet";

export default function ManageVenuesSection() {
  const { venues, hideVenue, unhideVenue } = useAdminVenues();
  const [query, setQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<AdminVenue | null>(null);
  const [hidingVenue, setHidingVenue] = useState<AdminVenue | null>(null);
  const [error, setError] = useState("");

  const results = query === "" ? [] : venues.filter((v) => matchesVenueSearch(v, query));

  async function handleUnhide(venue: AdminVenue) {
    setError("");
    const result = await unhideVenue(venue.id);
    if (!result.success) {
      setError(result.error ?? "Failed to unhide venue");
      return;
    }
    setSelectedVenue(null);
  }

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Manage Venues</h2>

      <div className="relative mt-3">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search venues by name or address..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="content-glass w-full rounded-xl py-3 pl-10 pr-10 text-base text-white placeholder-zinc-500 outline-none focus:border-[#38bdf8]"
        />
        {query !== "" ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {query !== "" ? (
        results.length === 0 ? (
          <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
            No venues found matching &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => setSelectedVenue(venue)}
                className="content-glass rounded-2xl p-4 text-left transition-colors hover:border-white/20"
              >
                <p className="text-sm font-semibold text-white">{venue.name}</p>
                <p className="mt-1 text-xs text-zinc-400">{venue.address}</p>
                <div className="mt-2 flex gap-2">
                  {!venue.admin_approved ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-400">
                      Pending
                    </span>
                  ) : null}
                  {venue.is_hidden ? (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] text-red-400">
                      Hidden
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )
      ) : null}

      {selectedVenue ? (
        <VenueActionSheet
          venue={selectedVenue}
          onHide={() => {
            setHidingVenue(selectedVenue);
            setSelectedVenue(null);
          }}
          onUnhide={() => void handleUnhide(selectedVenue)}
          onClose={() => setSelectedVenue(null)}
        />
      ) : null}

      {hidingVenue ? (
        <HideVenueDialog
          venueName={hidingVenue.name}
          onConfirm={(reason) => hideVenue(hidingVenue.id, reason)}
          onClose={() => setHidingVenue(null)}
        />
      ) : null}
    </section>
  );
}
