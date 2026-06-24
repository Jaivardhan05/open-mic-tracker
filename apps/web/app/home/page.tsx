"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Show, Venue } from "@repo/types";

import { MOCK_SHOWS } from "@/data/mockVenues";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import BrandMark from "@/components/BrandMark";
import VenueCard from "@/components/VenueCard";
import VenueDetailSheet from "@/components/VenueDetailSheet";
import { useAuth } from "../../src/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function HomePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/auth");
    }
  }, [user, isAuthLoading, router]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedVenueShows, setSelectedVenueShows] = useState<Show[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const runSearch = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data: { venues?: Venue[] } = await response.json();
      setVenues(Array.isArray(data.venues) ? data.venues : []);
    } catch (error) {
      console.error(error);
      setVenues([]);
    } finally {
      setIsLoading(false);
    }
  };

  async function handleSearch(e: FormEvent) {
    e.preventDefault();

    if (!searchQuery.trim()) {
      return;
    }

    await runSearch(searchQuery);
  };

  async function handleVenueSelect(venue: Venue) {
    setSelectedVenue(venue);
    setIsSheetOpen(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/${venue.id}`);
      const data = await res.json();
      setSelectedVenueShows(data.shows ?? []);
    } catch {
      setSelectedVenueShows([]);
    }
  }

  const suggestions = [
    "Busking spots tonight",
    "Free spots this week",
    "Spots after 8pm",
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="layout-root">
      <Navbar />
      <Sidebar
        onFilter={(query) => {
          if (!query) {
            setSearchQuery("");
            setVenues([]);
            setHasSearched(false);
            return;
          }

          setSearchQuery(query);
          void runSearch(query);
        }}
      />

      <main className="main-content-glass min-h-screen pb-12 mt-14 text-gray-100 lg:ml-56">
        <section className="px-4 pt-12 text-center">
          <h1>
            <BrandMark variant="hero" />
          </h1>
          <p className="mt-3 text-base md:text-lg">
            <span className="font-normal italic text-[#38bdf8] font-[family-name:var(--font-playfair)]">
              Take a stand
            </span>
            <span className="text-zinc-400 font-[family-name:var(--font-inter)]">,</span>
            <span className="text-zinc-400 font-[family-name:var(--font-inter)]">
              {" "}and find your{" "}
            </span>
            <span className="font-bold text-white font-[family-name:var(--font-inter)]">
              spot.
            </span>
          </p>
        </section>

        {!hasSearched ? (
          <section className="mt-6 flex flex-wrap justify-center gap-2 px-4">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setSearchQuery(suggestion);
                  void runSearch(suggestion);
                }}
                className="content-glass rounded-full px-4 py-2 text-sm text-zinc-300 hover:border-[#38bdf8] hover:text-[#38bdf8] motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97]"
              >
                {suggestion}
              </button>
            ))}
          </section>
        ) : null}

        <form
          onSubmit={handleSearch}
          className="mx-auto mt-8 w-full max-w-2xl px-4"
        >
          <div className="content-glass flex w-full items-center gap-2 rounded-full p-1.5">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              placeholder="Find a spot... e.g. busking tonight after 8pm"
              className="w-full rounded-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 min-w-14 items-center justify-center rounded-full bg-[#0a1628] px-4 text-sm font-bold text-white motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97] hover:bg-[#38bdf8] hover:text-black disabled:opacity-50"
            >
              {isLoading ? "Thinking..." : "Go"}
            </button>
          </div>
        </form>

        {isLoading ? (
          <p className="mt-10 px-4 text-center text-zinc-400">Finding spots…</p>
        ) : null}

        {hasSearched && !isLoading ? (
          <section className="mt-6 px-4 md:px-6">
            {venues.length === 0 ? (
              <p className="mt-10 text-center text-zinc-500">
                No spots found. Try a different search.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 md:px-6 xl:grid-cols-3">
                {venues.map((venue) => {
                  const venueShows = MOCK_SHOWS.filter((show) => show.venue_id === venue.id);

                  return (
                    <VenueCard
                      key={venue.id}
                      venue={venue}
                      shows={venueShows}
                      onSelect={handleVenueSelect}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </main>

      <VenueDetailSheet
        venue={selectedVenue}
        shows={selectedVenueShows}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  );
}
