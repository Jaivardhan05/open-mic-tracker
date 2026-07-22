"use client";

import { useState } from "react";

import type { NewSpotInput } from "@/hooks/useVenueSpots";

interface AddSpotFormProps {
  onSubmit: (input: NewSpotInput) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export default function AddSpotForm({ onSubmit, onClose }: AddSpotFormProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [totalSpots, setTotalSpots] = useState("1");
  const [spotType, setSpotType] = useState<"busking" | "non_busking">("non_busking");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date || !startTime || !endTime) {
      setError("Date, start time, and end time are required");
      return;
    }

    const total = Number(totalSpots);
    if (!Number.isInteger(total) || total <= 0) {
      setError("Total spots must be a positive whole number");
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit({
      date,
      start_time: startTime,
      end_time: endTime,
      spot_type: spotType,
      total_spots: total,
      price: isFree ? null : Number(price) || 0,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create spot");
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="content-glass w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Add a new Spot</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 transition-colors hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]/60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Total spots available</label>
            <input
              type="number"
              min={1}
              max={100}
              value={totalSpots}
              onChange={(e) => setTotalSpots(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]/60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSpotType("non_busking")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  spotType === "non_busking"
                    ? "bg-[#38bdf8] text-white"
                    : "border border-white/10 bg-black/30 text-zinc-400 hover:text-white"
                }`}
              >
                Non-Busking
              </button>
              <button
                type="button"
                onClick={() => setSpotType("busking")}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  spotType === "busking"
                    ? "bg-[#38bdf8] text-white"
                    : "border border-white/10 bg-black/30 text-zinc-400 hover:text-white"
                }`}
              >
                Busking
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Price</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  isFree
                    ? "bg-[#38bdf8] text-white"
                    : "border border-white/10 bg-black/30 text-zinc-400 hover:text-white"
                }`}
              >
                Free
              </button>
              <div
                className={`flex flex-1 items-center rounded-xl px-3 ${
                  isFree ? "border border-white/10 bg-black/30" : "border border-[#38bdf8]/60 bg-black/30"
                }`}
              >
                <span className="text-sm text-zinc-400">₹</span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onFocus={() => setIsFree(false)}
                  onChange={(e) => {
                    setIsFree(false);
                    setPrice(e.target.value);
                  }}
                  placeholder="Amount"
                  className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-[#38bdf8] py-3 font-bold text-white transition-colors hover:bg-[#0ea5e9] disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create Spot"}
          </button>
        </form>
      </div>
    </div>
  );
}
