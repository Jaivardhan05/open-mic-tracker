"use client";

import type { Spot } from "@repo/types";

interface VenueCalendarSectionProps {
  spots: Spot[];
  isLoading: boolean;
  onViewRequests: (spotId: string) => void;
  onCancelSpot: (spotId: string) => void;
}

export default function VenueCalendarSection({
  spots,
  isLoading,
  onViewRequests,
  onCancelSpot,
}: VenueCalendarSectionProps) {
  if (isLoading) {
    return null;
  }

  const byDate = new Map<string, Spot[]>();
  for (const spot of spots) {
    const existing = byDate.get(spot.date);
    if (existing) {
      existing.push(spot);
    } else {
      byDate.set(spot.date, [spot]);
    }
  }

  const dates = Array.from(byDate.keys()).sort();
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Your Spots</h2>
      {dates.length === 0 ? (
        <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
          No spots scheduled yet.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dates.map((dateKey) => {
            const date = new Date(`${dateKey}T00:00:00`);
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={`content-glass flex flex-col rounded-xl p-3 ${
                  isToday ? "border border-[#38bdf8]/40" : "border border-white/10"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase text-zinc-400">
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="text-xs font-bold text-white">
                  {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {byDate.get(dateKey)!.map((spot) => (
                    <div
                      key={spot.id}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        spot.is_cancelled
                          ? "border-zinc-700 bg-white/5 text-zinc-500 line-through"
                          : "border-zinc-600/60 bg-white/5 text-zinc-200"
                      }`}
                    >
                      <p className="font-semibold">
                        {spot.start_time}–{spot.end_time} ·{" "}
                        {spot.spot_type === "busking" ? "Busking" : "Non-Busking"}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400 no-underline">
                        {spot.available_spots}/{spot.total_spots} spots ·{" "}
                        {spot.price ? `₹${spot.price}` : "Free"}
                      </p>
                      {spot.is_cancelled ? (
                        <p className="mt-1 text-[11px] text-red-400 no-underline">
                          {spot.cancellation_message}
                        </p>
                      ) : (
                        <div className="mt-2 flex gap-2 no-underline">
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
