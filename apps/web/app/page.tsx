"use client";

import Image from "next/image";
import { useState } from "react";

import type { Show, Venue } from "@repo/types";

import ChatInput from "@/components/ChatInput";
import { MOCK_SHOWS, MOCK_VENUES } from "@/data/mockVenues";

export default function Home() {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleSearch = async (input?: string) => {
    const effectiveQuery = (input ?? query).trim();
    if (!effectiveQuery) {
      return;
    }

    const normalizedQuery = effectiveQuery.toLowerCase();

    setIsLoading(true);
    setHasSearched(true);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1200);
    });

    const wantsBusking =
      normalizedQuery.includes("busking") &&
      !normalizedQuery.includes("non-busking") &&
      !normalizedQuery.includes("non busking");
    const wantsNonBusking =
      normalizedQuery.includes("non-busking") || normalizedQuery.includes("non busking");
    const wantsEightPm =
      normalizedQuery.includes("8pm") ||
      normalizedQuery.includes("20:00") ||
      normalizedQuery.includes("after 8pm");
    const wantsFree = normalizedQuery.includes("free");

    const hasSpecificFilter =
      wantsBusking ||
      wantsNonBusking ||
      wantsEightPm ||
      wantsFree ||
      MOCK_VENUES.some((venue) => {
        return (
          normalizedQuery.includes(venue.name.toLowerCase()) ||
          normalizedQuery.includes(venue.city.toLowerCase())
        );
      });

    const filteredVenues = MOCK_VENUES.filter((venue) => {
      const venueShows: Show[] = MOCK_SHOWS.filter((show) => show.venue_id === venue.id);
      const matchNameOrCity =
        normalizedQuery.includes(venue.name.toLowerCase()) ||
        normalizedQuery.includes(venue.city.toLowerCase());

      const matchBusking = wantsBusking
        ? venueShows.some((show) => show.spot_type === "busking")
        : false;

      const matchNonBusking = wantsNonBusking
        ? venueShows.some((show) => show.spot_type === "non_busking")
        : false;

      const matchEightPm = wantsEightPm
        ? venueShows.some((show) => {
            return show.start_time === "20:00" || show.start_time === "21:00";
          })
        : false;

      const matchFree = wantsFree ? venueShows.some((show) => show.charge === 0) : false;

      if (!hasSpecificFilter) {
        return true;
      }

      return matchNameOrCity || matchBusking || matchNonBusking || matchEightPm || matchFree;
    });

    setResults(filteredVenues);
    setIsLoading(false);
  };

  const suggestions = [
    "Busking spots tonight",
    "Free spots this week",
    "Spots after 8pm",
  ];

  return (
    <>
      <main className="min-h-screen bg-gray-950 text-gray-100 p-8 pb-28">
        <section className="px-4 pt-12 text-center">
          <h1 className="text-4xl font-bold text-center mb-8">OpenMic Delhi</h1>
          <p className="mt-2 text-zinc-400">Find your next spot.</p>
        </section>

        {!hasSearched ? (
          <section className="mt-6 flex flex-wrap justify-center gap-2 px-4">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  void handleSearch(suggestion);
                }}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400"
              >
                {suggestion}
              </button>
            ))}
          </section>
        ) : null}

        {isLoading ? (
          <p className="mt-10 px-4 text-center text-zinc-400">Finding spots…</p>
        ) : null}

        {hasSearched && !isLoading ? (
          <section className="mt-6 px-4">
            {results.length === 0 ? (
              <p className="mt-10 text-center text-zinc-500">
                No spots found. Try a different search.
              </p>
            ) : (
              results.map((venue) => {
                const venueShows = MOCK_SHOWS.filter((show) => show.venue_id === venue.id);

                const hasFreeShow = venueShows.some((show) => show.charge === 0);
                const lowestCharge = venueShows.reduce<number>((min, show) => {
                  return show.charge < min ? show.charge : min;
                }, Number.POSITIVE_INFINITY);

                const chargeLabel = hasFreeShow
                  ? "Free"
                  : Number.isFinite(lowestCharge)
                    ? "From ₹" + lowestCharge
                    : "No upcoming shows";

                return (
                  <article
                    key={venue.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg max-w-sm mx-auto mb-6"
                  >
                    <Image
                      src={venue.photos[0] ?? "https://picsum.photos/seed/fallback/600/400"}
                      alt={venue.name + " venue photo"}
                      width={600}
                      height={400}
                      unoptimized
                      className="w-full h-48 object-cover"
                    />

                    <div className="p-5">
                      <h2 className="text-xl font-bold text-white">{venue.name}</h2>
                      <p className="mt-1 text-sm text-zinc-400">{venue.address}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {venueShows.map((show) => {
                          const chipClass =
                            show.spot_type === "busking"
                              ? "bg-amber-400/20 text-amber-300"
                              : "bg-purple-500/20 text-purple-300";

                          return (
                            <span
                              key={show.id}
                              className={
                                "rounded-full px-3 py-1 text-xs font-medium " + chipClass
                              }
                            >
                              {show.start_time}
                            </span>
                          );
                        })}
                      </div>

                      <p className="mt-4 text-sm font-semibold text-zinc-200">{chargeLabel}</p>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        ) : null}
      </main>

      <ChatInput
        value={query}
        onChange={setQuery}
        onSubmit={() => {
          void handleSearch();
        }}
        isLoading={isLoading}
      />
    </>
  );
}
