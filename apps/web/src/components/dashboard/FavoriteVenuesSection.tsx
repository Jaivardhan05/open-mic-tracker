"use client";

import { useEffect, useState } from "react";

import type { FavoriteVenue } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export default function FavoriteVenuesSection() {
  const [venues, setVenues] = useState<FavoriteVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/me/favorite-venues");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setVenues(Array.isArray(data) ? data : []);
        }
      } catch {
        // section stays empty on failure, no fabricated content
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <section className="mt-8 px-4 pb-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Favorite Venues</h2>
      {venues.length === 0 ? (
        <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
          Book more shows to see your favorite venues here.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {venues.map((venue) => (
            <div key={venue.id} className="content-glass rounded-2xl p-4">
              <p className="text-sm font-semibold text-white">{venue.name}</p>
              <p className="mt-1 text-xs text-zinc-400">{venue.address}</p>
              <span className="mt-2 inline-flex rounded-full bg-[#38bdf8]/20 px-3 py-1 text-[11px] font-semibold text-[#38bdf8]">
                {venue.booking_count} booking{venue.booking_count > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
