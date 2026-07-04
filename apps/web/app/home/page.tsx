"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Show, Venue } from "@repo/types";

import { MOCK_SHOWS } from "@/data/mockVenues";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import BrandMark from "@/components/BrandMark";
import VenueCard from "@/components/VenueCard";
import VenueDetailSheet from "@/components/VenueDetailSheet";
import { useAuth } from "../../src/context/AuthContext";

export default function HomePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/auth");
    }
  }, [user, isAuthLoading, router]);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedVenueShows, setSelectedVenueShows] = useState<Show[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  async function handleVenueSelect(venue: Venue) {
    setSelectedVenue(venue);
    setIsSheetOpen(true);
    try {
      const res = await fetch(`/api/venues/${venue.id}`);
      const data = await res.json();
      setSelectedVenueShows(data.shows ?? []);
    } catch {
      setSelectedVenueShows([]);
    }
  }

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
            setVenues([]);
            return;
          }
        }}
      />

      <main
        className="main-content-glass sidebar-content-margin pb-12 text-gray-100 lg:ml-[var(--sidebar-w)] overflow-y-auto"
        style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
      >
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

        {venues.length > 0 ? (
          <section className="mt-6 px-4 md:px-6">
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
