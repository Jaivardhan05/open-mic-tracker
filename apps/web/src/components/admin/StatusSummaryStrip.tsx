"use client";

import type { VenueDisplayStatus } from "@repo/types";

import { IconGrid } from "@/components/icons/NavIcons";
import { STATUS_META, STATUS_ORDER } from "@/lib/venueStatus";

import StatusIcon from "./StatusIcons";

export type StatusFilter = "all" | VenueDisplayStatus;

interface StatusSummaryStripProps {
  counts: Record<StatusFilter, number>;
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
}

// Counts per status that double as filters. Each venue has exactly one
// status, so the counts add up to the total. "Pending review" is the
// dominant tile: it is the one that needs the admin.
export default function StatusSummaryStrip({ counts, value, onChange }: StatusSummaryStripProps) {
  const tiles: StatusFilter[] = [
    "pending",
    "all",
    ...STATUS_ORDER.filter((s) => s !== "pending"),
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8" role="group" aria-label="Filter venues by status">
      {tiles.map((tile) => {
        const active = value === tile;
        const isPending = tile === "pending";
        const meta = tile === "all" ? null : STATUS_META[tile];
        const color = meta?.color ?? "#38bdf8";

        return (
          <button
            key={tile}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tile)}
            className={`glass-panel flex min-h-[44px] flex-col justify-between rounded-2xl p-3 text-left motion-safe:transition-colors motion-safe:duration-150 hover:border-white/30 ${
              isPending ? "col-span-2" : ""
            }`}
            style={{ borderColor: active ? "#38bdf8" : undefined }}
          >
            <span className="flex items-center gap-2" style={{ color }}>
              {tile === "all" ? (
                <IconGrid className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <StatusIcon status={tile} className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-400">
                {tile === "all" ? "All venues" : meta?.label}
              </span>
            </span>
            <span className="mt-2 flex items-baseline gap-2">
              <span
                className={`font-[family-name:var(--font-bebas)] leading-none text-white ${
                  isPending ? "text-5xl" : "text-3xl"
                }`}
              >
                {counts[tile]}
              </span>
              {isPending ? (
                <span className="font-[family-name:var(--font-cormorant)] text-base italic text-zinc-400">
                  {counts.pending > 0 ? "waiting on you" : "all clear"}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
