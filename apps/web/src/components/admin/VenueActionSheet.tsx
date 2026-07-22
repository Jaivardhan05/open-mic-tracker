"use client";

import type { AdminVenue } from "@repo/types";

interface VenueActionSheetProps {
  venue: AdminVenue;
  onHide: () => void;
  onUnhide: () => void;
  onClose: () => void;
}

export default function VenueActionSheet({ venue, onHide, onUnhide, onClose }: VenueActionSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="content-glass w-full max-w-md rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white">{venue.name}</h2>
        <p className="mt-1 text-sm text-zinc-400">{venue.address}</p>
        {venue.is_hidden ? (
          <p className="mt-2 text-xs text-amber-400">Currently hidden{venue.hidden_reason ? `: ${venue.hidden_reason}` : ""}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {venue.is_hidden ? (
            <button
              type="button"
              onClick={onUnhide}
              className="w-full rounded-xl bg-[#38bdf8] py-3 text-sm font-bold text-white transition-colors hover:bg-[#0ea5e9]"
            >
              Unhide Venue
            </button>
          ) : (
            <button
              type="button"
              onClick={onHide}
              className="w-full rounded-xl border border-red-800 bg-red-900/40 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/60"
            >
              Hide Venue
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/10 bg-black/30 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
