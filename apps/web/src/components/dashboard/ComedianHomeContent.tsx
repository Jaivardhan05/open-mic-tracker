"use client";

import { useState } from "react";

import type { Show, Venue } from "@repo/types";

import { MOCK_SHOWS } from "@/data/mockVenues";
import BrandMark from "@/components/BrandMark";
import VenueCard from "@/components/VenueCard";
import VenueDetailSheet from "@/components/VenueDetailSheet";
import RemindersSection from "@/components/dashboard/RemindersSection";
import CalendarSection from "@/components/dashboard/CalendarSection";
import FavoriteVenuesSection from "@/components/dashboard/FavoriteVenuesSection";
import { useComedianBookings } from "@/hooks/useComedianBookings";
import { useMySpotRequests } from "@/hooks/useMySpotRequests";

export default function ComedianHomeContent() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedVenueShows, setSelectedVenueShows] = useState<Show[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { bookings, isLoading: isBookingsLoading, bookSpot, cancelBooking, declineBooking } =
    useComedianBookings();
  const { spotRequests, isLoading: isSpotRequestsLoading, cancelSpotRequest } = useMySpotRequests();

  async function loadVenueShows(venueId: string) {
    try {
      const res = await fetch(`/api/venues/${venueId}`);
      const data = await res.json();
      setSelectedVenueShows(data.shows ?? []);
    } catch {
      setSelectedVenueShows([]);
    }
  }

  async function handleVenueSelect(venue: Venue) {
    setSelectedVenue(venue);
    setIsSheetOpen(true);
    await loadVenueShows(venue.id);
  }

  async function handleBookSpot(showId: string) {
    const result = await bookSpot(showId);
    if (result.success && selectedVenue) {
      await loadVenueShows(selectedVenue.id);
    }
    return result;
  }

  async function handleCancelFromSheet(bookingId: string) {
    const result = await cancelBooking(bookingId);
    if (result.success && selectedVenue) {
      await loadVenueShows(selectedVenue.id);
    }
    return result;
  }

  return (
    <>
      <section className="px-4 pt-12 text-center">
        <h1>
          <BrandMark variant="hero" />
        </h1>
        <p className="mt-3 text-base md:text-lg">
          <span className="font-normal italic text-[#38bdf8] font-[family-name:var(--font-playfair)]">
            Take a stand
          </span>
          <span className="text-zinc-400 font-[family-name:var(--font-inter)]">,</span>
          <span className="text-zinc-400 font-[family-name:var(--font-inter)]"> and find your </span>
          <span className="font-bold text-white font-[family-name:var(--font-inter)]">spot.</span>
        </p>
      </section>

      <RemindersSection
        bookings={bookings}
        isLoading={isBookingsLoading}
        onCancel={cancelBooking}
        onDecline={declineBooking}
        spotRequests={spotRequests}
        isSpotRequestsLoading={isSpotRequestsLoading}
        onCancelSpotRequest={cancelSpotRequest}
      />
      <CalendarSection />
      <FavoriteVenuesSection />

      {venues.length > 0 ? (
        <section className="mt-6 px-4 md:px-6">
          <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 md:px-6 xl:grid-cols-3">
            {venues.map((venue) => {
              const venueShows = MOCK_SHOWS.filter((show) => show.venue_id === venue.id);

              return (
                <VenueCard key={venue.id} venue={venue} shows={venueShows} onSelect={handleVenueSelect} />
              );
            })}
          </div>
        </section>
      ) : null}

      <VenueDetailSheet
        venue={selectedVenue}
        shows={selectedVenueShows}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        bookings={bookings}
        onBook={handleBookSpot}
        onCancel={handleCancelFromSheet}
      />
    </>
  );
}
