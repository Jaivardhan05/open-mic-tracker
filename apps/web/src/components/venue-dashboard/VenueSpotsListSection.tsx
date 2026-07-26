"use client";

import type { Spot } from "@repo/types";

interface VenueSpotsListSectionProps {
  spots: Spot[];
  isLoading: boolean;
  onViewRequests: (spotId: string) => void;
  onCancelSpot: (spotId: string) => void;
}

export default function VenueSpotsListSection({
  spots,
  isLoading,
  onViewRequests,
  onCancelSpot,
}: VenueSpotsListSectionProps) {
  if (isLoading) {
    return null;
  }

  const sortedSpots = [...spots].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.start_time < b.start_time ? -1 : 1;
  });

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Your Spots</h2>
      {sortedSpots.length === 0 ? (
        <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
          No spots scheduled yet.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {sortedSpots.map((spot) => (
            <div
              key={spot.id}
              className={`content-glass rounded-xl border px-4 py-3 text-sm ${
                spot.is_cancelled ? "border-zinc-700 text-zinc-500" : "border-white/10 text-zinc-200"
              }`}
            >
              <p className={`font-semibold ${spot.is_cancelled ? "line-through" : ""}`}>
                {new Date(`${spot.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {spot.start_time}–{spot.end_time} ·{" "}
                {spot.spot_type === "busking" ? "Busking" : "Non-Busking"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {spot.available_spots}/{spot.total_spots} spots ·{" "}
                {spot.price ? `₹${spot.price}` : "Free"}
              </p>
              {spot.is_cancelled ? (
                <p className="mt-1 text-xs text-red-400">{spot.cancellation_message}</p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onViewRequests(spot.id)}
                    className="rounded-lg border border-[#38bdf8]/50 px-2 py-1 text-[11px] font-semibold text-[#38bdf8] transition-colors hover:bg-[#38bdf8]/10"
                  >
                    View Requests
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelSpot(spot.id)}
                    className="rounded-lg border border-red-800 px-2 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-900/40"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
