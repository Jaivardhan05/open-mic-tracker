"use client";

import type { Spot } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import { IconBusking, IconClock, IconInfo, IconStage } from "@/components/icons/NavIcons";
import { formatSpotDate as formatCardDate, formatTime12h } from "@/lib/formatDate";

interface VenueSpotCardProps {
  spot: Spot;
  onViewRequests: (spotId: string) => void;
  onEditSpot: (spotId: string) => void;
  onCancelSpot: (spotId: string) => void;
}

const MAX_METER_BLOCKS = 12;

export default function VenueSpotCard({ spot, onViewRequests, onEditSpot, onCancelSpot }: VenueSpotCardProps) {
  const filled = spot.total_spots - spot.available_spots;
  const isFull = spot.available_spots <= 0;
  const isFillingUp = !isFull && spot.available_spots <= 2;
  const isCancelled = spot.is_cancelled;

  const spineStyle = isCancelled
    ? {
        background:
          "repeating-linear-gradient(135deg, #7f1d1d 0px, #7f1d1d 6px, #18181b 6px, #18181b 12px)",
      }
    : { background: isFillingUp ? "#facc15" : "#38bdf8" };

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
            {formatCardDate(spot.date)}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            {spot.spot_type === "busking" ? (
              <IconBusking className="h-3.5 w-3.5" />
            ) : (
              <IconStage className="h-3.5 w-3.5" />
            )}
            {spot.spot_type === "busking" ? "Busking" : "Non-Busking"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-300">
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="h-3.5 w-3.5 text-zinc-500" />
            {formatTime12h(spot.start_time)} &ndash; {formatTime12h(spot.end_time)}
          </span>
          <span className="text-white font-semibold">
            {spot.price ? `₹${spot.price}` : "Free"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-[3px]" aria-hidden="true">
            {spot.total_spots <= MAX_METER_BLOCKS ? (
              Array.from({ length: spot.total_spots }).map((_, i) => (
                <span
                  key={i}
                  className="h-3 w-2 rounded-[1px] border"
                  style={
                    i < filled
                      ? {
                          backgroundColor: isCancelled ? "#52525b" : "#38bdf8",
                          borderColor: isCancelled ? "#52525b" : "#38bdf8",
                        }
                      : { borderColor: "rgba(255,255,255,0.25)" }
                  }
                />
              ))
            ) : (
              <span className="h-3 w-16 overflow-hidden rounded-[1px] border border-white/25">
                <span
                  className="block h-full"
                  style={{
                    width: `${(filled / spot.total_spots) * 100}%`,
                    backgroundColor: isCancelled ? "#52525b" : "#38bdf8",
                  }}
                />
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400">
            {filled}/{spot.total_spots} spots
          </span>
        </div>

        {isCancelled ? (
          <div className="flex items-start gap-2 border-t border-dashed border-white/10 pt-3 text-xs text-red-300/90">
            <IconInfo className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p>{spot.cancellation_message || "Spot canceled by venue"}</p>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={() => onViewRequests(spot.id)}>View Requests</CtaButton>
            </span>
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={() => onEditSpot(spot.id)}>Edit</CtaButton>
            </span>
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={() => onCancelSpot(spot.id)}>Cancel</CtaButton>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
