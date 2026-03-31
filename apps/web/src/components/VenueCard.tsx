import Image from "next/image";

import type { Show, Venue } from "@repo/types";

interface VenueCardProps {
  venue: Venue;
  shows: Show[];
}

export default function VenueCard({ venue, shows }: VenueCardProps) {
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
    <article className="mb-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <Image
        src={venue.photos[0] ?? "https://picsum.photos/seed/fallback/600/400"}
        alt={venue.name + " venue photo"}
        width={600}
        height={400}
        unoptimized
        className="h-48 w-full rounded-t-2xl object-cover"
      />

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
          className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"
        >
          Book This Spot
        </button>
      </div>
    </article>
  );
}
