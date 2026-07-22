import Image from "next/image";
import { useState } from "react";

import type { Booking, Show, Venue } from "@repo/types";

interface VenueDetailSheetProps {
  venue: Venue | null;
  shows: Show[];
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  onBook: (showId: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
}

export default function VenueDetailSheet({
  venue,
  shows,
  isOpen,
  onClose,
  bookings,
  onBook,
  onCancel,
}: VenueDetailSheetProps) {
  const [pendingShowId, setPendingShowId] = useState<string | null>(null);
  const [errorByShow, setErrorByShow] = useState<Record<string, string>>({});

  if (!isOpen || venue === null) {
    return null;
  }

  async function handleBook(showId: string) {
    setPendingShowId(showId);
    setErrorByShow((prev) => ({ ...prev, [showId]: "" }));
    const result = await onBook(showId);
    if (!result.success) {
      setErrorByShow((prev) => ({ ...prev, [showId]: result.error ?? "Failed to book spot" }));
    }
    setPendingShowId(null);
  }

  async function handleCancel(bookingId: string, showId: string) {
    setPendingShowId(showId);
    setErrorByShow((prev) => ({ ...prev, [showId]: "" }));
    const result = await onCancel(bookingId);
    if (!result.success) {
      setErrorByShow((prev) => ({ ...prev, [showId]: result.error ?? "Failed to cancel booking" }));
    }
    setPendingShowId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pt-16 md:items-center md:pt-20">
      <button
        type="button"
        aria-label="Close venue details"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      <div className="relative bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto overscroll-contain z-10 p-4 md:p-6 pb-8">
        <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-zinc-700" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 w-11 h-11 flex items-center justify-center text-2xl text-zinc-400 rounded-xl active:bg-zinc-800"
        >
          ×
        </button>

        <Image
          src={venue.photos[0] ?? "https://picsum.photos/seed/fallback/600/400"}
          alt={venue.name}
          width={600}
          height={300}
          unoptimized
          className="mb-4 w-full rounded-2xl object-cover"
        />

        <h2 className="mb-1 text-2xl font-bold text-white">{venue.name}</h2>
        <p className="mb-6 text-sm text-zinc-400">{venue.address}</p>

        <h3 className="mb-4 text-lg font-semibold text-white">Available Shows</h3>

        {shows.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">No upcoming shows at this venue.</p>
        ) : (
          shows.map((show) => {
            const formattedDate = new Date(show.date).toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            const spotTypeClass =
              show.spot_type === "busking"
                ? "bg-amber-400/20 text-amber-300"
                : "bg-purple-500/20 text-purple-300";

            const spotTypeLabel = show.spot_type === "busking" ? "Busking" : "Non-Busking";
            const availabilityClass =
              show.available_spots <= 3 ? "text-red-400" : "text-green-400";

            return (
              <article key={show.id} className="mb-3 rounded-2xl bg-zinc-800 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-400">{formattedDate}</p>
                  <span
                    className={"rounded-full px-2 py-1 text-xs font-medium " + spotTypeClass}
                  >
                    {spotTypeLabel}
                  </span>
                </div>

                <p className="mt-1 text-xl font-bold text-white">
                  {show.start_time} - {show.end_time}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <p className={availabilityClass}>
                    Available spots: {show.available_spots}/{show.total_spots}
                  </p>
                  <p className={show.charge === 0 ? "text-green-400" : "text-white"}>
                    {show.charge === 0 ? "Free" : "₹" + show.charge}
                  </p>
                </div>

                {errorByShow[show.id] ? (
                  <p className="mt-2 text-xs text-red-400">{errorByShow[show.id]}</p>
                ) : null}

                {(() => {
                  const existingBooking = bookings.find((b) => b.show?.id === show.id);
                  const isPending = pendingShowId === show.id;

                  if (existingBooking?.booking_status === "awaiting_confirmation") {
                    return (
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-400">
                          Waiting for confirmation
                        </span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCancel(existingBooking.id, show.id)}
                          className="min-h-[44px] rounded-xl border border-red-800 bg-red-900/40 px-4 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
                        >
                          {isPending ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    );
                  }

                  if (existingBooking?.booking_status === "confirmed_awaiting_comedian") {
                    return (
                      <p className="mt-3 rounded-xl bg-[#38bdf8]/10 px-3 py-2 text-center text-xs font-semibold text-[#38bdf8]">
                        Confirmed by venue — respond in Reminders &amp; Confirmations
                      </p>
                    );
                  }

                  return (
                    <button
                      type="button"
                      disabled={isPending || show.available_spots <= 0}
                      onClick={() => handleBook(show.id)}
                      className="mt-3 w-full min-h-[44px] rounded-xl bg-white py-3 text-sm font-bold text-black hover:bg-[#38bdf8] hover:text-white transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? "Booking…" : "Book This Spot"}
                    </button>
                  );
                })()}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
