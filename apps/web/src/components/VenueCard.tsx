import Image from "next/image";

import type { Show, Venue } from "@repo/types";

interface VenueCardProps {
  venue: Venue;
  shows: Show[];
  onSelect: (venue: Venue) => void;
}

export default function VenueCard({ venue, shows, onSelect }: VenueCardProps) {
  const hasFreeShow = shows.some((show) => show.charge === 0);
  const lowestCharge = shows.reduce<number>((min, show) => {
    return show.charge < min ? show.charge : min;
  }, Number.POSITIVE_INFINITY);

  const chargeLabel = hasFreeShow
    ? "Free"
    : Number.isFinite(lowestCharge)
      ? "From ₹" + lowestCharge
      : "No upcoming shows";

  return (
    <article
      onClick={() => onSelect(venue)}
      className="content-glass mb-4 cursor-pointer overflow-hidden rounded-2xl backdrop-blur-[12px]"
    >
      <div className="relative aspect-video w-full">
        <Image
          src={venue.photos[0] ?? "https://picsum.photos/seed/fallback/600/400"}
          alt={venue.name + " venue photo"}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
          className="rounded-t-2xl object-cover"
        />
      </div>

      <div className="p-4">
        <h2 className="text-xl font-bold text-white">{venue.name}</h2>
        <p className="mt-1 text-sm text-zinc-400">{venue.address}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {shows.map((show) => {
            const chipClass =
              show.spot_type === "busking"
                ? "bg-amber-400/20 text-amber-300"
                : "bg-purple-500/20 text-purple-300";

            return (
              <span
                key={show.id}
                className={"rounded-full px-3 py-1 text-xs font-medium " + chipClass}
              >
                {show.start_time}
              </span>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-semibold text-zinc-200">{chargeLabel}</p>

        <button
          type="button"
          onClick={() => {
            console.log("book venue", venue.id);
          }}
          className="mt-4 w-full min-h-[44px] rounded-xl bg-white py-3 text-sm font-bold text-black transition-all duration-200 hover:bg-[#F97316] hover:text-white"
        >
          Book This Spot
        </button>
      </div>
    </article>
  );
}
