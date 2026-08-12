"use client";

import type { Spot } from "@repo/types";

import VenueSpotCard from "./VenueSpotCard";

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
        <div className="mt-3 flex flex-col gap-3">
          {sortedSpots.map((spot) => (
            <VenueSpotCard
              key={spot.id}
              spot={spot}
              onViewRequests={onViewRequests}
              onCancelSpot={onCancelSpot}
            />
          ))}
        </div>
      )}
    </section>
  );
}
