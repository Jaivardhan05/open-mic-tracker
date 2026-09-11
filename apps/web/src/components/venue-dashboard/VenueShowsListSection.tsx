"use client";

import type { VenueShow } from "@repo/types";

import VenueShowCard from "./VenueShowCard";

interface VenueShowsListSectionProps {
  shows: VenueShow[];
  isLoading: boolean;
  onViewRequests: (spotId: string) => void;
  onEditShow: (showId: string) => void;
  onCancelShow: (showId: string) => void;
}

export default function VenueShowsListSection({
  shows,
  isLoading,
  onViewRequests,
  onEditShow,
  onCancelShow,
}: VenueShowsListSectionProps) {
  if (isLoading) {
    return null;
  }

  const sortedShows = [...shows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.start_time < b.start_time ? -1 : 1;
  });

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Your Shows</h2>
      {sortedShows.length === 0 ? (
        <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
          No shows scheduled yet.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {sortedShows.map((show) => (
            <VenueShowCard
              key={show.id}
              show={show}
              onViewRequests={onViewRequests}
              onEditShow={onEditShow}
              onCancelShow={onCancelShow}
            />
          ))}
        </div>
      )}
    </section>
  );
}
