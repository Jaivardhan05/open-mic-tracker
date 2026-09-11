"use client";

import type { PoolType, Spot, VenueShow } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import { IconBusking, IconClock, IconInfo, IconStage, IconUser } from "@/components/icons/NavIcons";
import { formatSpotDate as formatCardDate, formatTime12h } from "@/lib/formatDate";

interface VenueShowCardProps {
  show: VenueShow;
  onViewRequests: (spotId: string) => void;
  onEditShow: (showId: string) => void;
  onCancelShow: (showId: string) => void;
}

const MAX_METER_BLOCKS = 12;

// Flat colors per pool, matching the busking/non-busking colors already
// used on /venues/[id] plus a new flat yellow for hosting — no gradients,
// same "one accent per category" rule the rest of the dashboard follows.
// See specs/venue-dashboard.md §9.4.
const POOL_META: Record<PoolType, { label: string; color: string; Icon: typeof IconBusking }> = {
  busking: { label: "Busking", color: "#38bdf8", Icon: IconBusking },
  non_busking: { label: "Non-Busking", color: "#f472b6", Icon: IconStage },
  hosting: { label: "Hosting", color: "#facc15", Icon: IconUser },
};

function PoolRow({
  type,
  pool,
  onViewRequests,
}: {
  type: PoolType;
  pool: Spot;
  onViewRequests: (spotId: string) => void;
}) {
  const meta = POOL_META[type];
  const filled = pool.total_spots - pool.available_spots;
  const isFull = pool.available_spots <= 0;
  const isFillingUp = !isFull && pool.available_spots <= 2;
  const blockColor = isFillingUp ? "#facc15" : meta.color;

  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
          <meta.Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
        <span className="text-sm font-semibold text-white">{pool.price ? `₹${pool.price}` : "Free"}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-[3px]" aria-hidden="true">
          {pool.total_spots <= MAX_METER_BLOCKS ? (
            Array.from({ length: pool.total_spots }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-2 rounded-[1px] border"
                style={
                  i < filled
                    ? { backgroundColor: blockColor, borderColor: blockColor }
                    : { borderColor: "rgba(255,255,255,0.25)" }
                }
              />
            ))
          ) : (
            <span className="h-3 w-16 overflow-hidden rounded-[1px] border border-white/25">
              <span
                className="block h-full"
                style={{ width: `${(filled / pool.total_spots) * 100}%`, backgroundColor: blockColor }}
              />
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {filled}/{pool.total_spots} spots
        </span>
        <span className="ml-auto inline-flex min-h-[44px] items-center">
          <CtaButton onClick={() => onViewRequests(pool.id)}>View Requests</CtaButton>
        </span>
      </div>
    </div>
  );
}

export default function VenueShowCard({ show, onViewRequests, onEditShow, onCancelShow }: VenueShowCardProps) {
  const isCancelled = show.is_cancelled;
  const pools: [PoolType, Spot | null][] = [
    ["busking", show.busking],
    ["non_busking", show.non_busking],
    ["hosting", show.hosting],
  ];
  const activePools = pools.filter((entry): entry is [PoolType, Spot] => entry[1] !== null);

  const spineStyle = isCancelled
    ? {
        background:
          "repeating-linear-gradient(135deg, #7f1d1d 0px, #7f1d1d 6px, #18181b 6px, #18181b 12px)",
      }
    : { background: "#38bdf8" };

  return (
    <div
      className={`content-glass relative flex overflow-hidden rounded-2xl border ${
        isCancelled ? "border-white/5" : "border-white/10"
      }`}
      style={{ backdropFilter: "blur(40px) saturate(120%)", WebkitBackdropFilter: "blur(40px) saturate(120%)" }}
    >
      <span aria-hidden="true" className="w-[5px] flex-shrink-0" style={spineStyle} />

      {isCancelled ? (
        <span
          className="absolute right-0 top-0 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-red-300"
          style={{
            backgroundColor: "#1a0a0a",
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          Cancelled
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pr-16">
          <p
            className="font-[family-name:var(--font-bebas)] uppercase leading-none text-white"
            style={{ fontSize: "clamp(1.4rem, 5vw, 1.8rem)", letterSpacing: "0.5px" }}
          >
            {formatCardDate(show.date)}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            <IconClock className="h-3.5 w-3.5 text-zinc-500" />
            {formatTime12h(show.start_time)} &ndash; {formatTime12h(show.end_time)}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {activePools.map(([type, pool]) => (
            <PoolRow key={type} type={type} pool={pool} onViewRequests={onViewRequests} />
          ))}
        </div>

        {isCancelled ? (
          <div className="flex items-start gap-2 border-t border-dashed border-white/10 pt-3 text-xs text-red-300/90">
            <IconInfo className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>{show.cancellation_message || "Show canceled by venue"}</p>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={() => onEditShow(show.id)}>Edit</CtaButton>
            </span>
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={() => onCancelShow(show.id)}>Cancel</CtaButton>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
