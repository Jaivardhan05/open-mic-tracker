"use client";

import { useState } from "react";

import type { NewShowInput } from "@/hooks/useVenueShows";
import CtaButton from "@/components/CtaButton";
import { IconClose } from "@/components/icons/NavIcons";

import { DateTimeField, NumberField, PoolLabel, PriceField, SpotFormModal, ToggleCta } from "./SpotFormShared";

interface AddShowFormProps {
  onSubmit: (input: NewShowInput) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

// Colors match /venues/[id]'s existing busking/non-busking spot_type colors
// plus a new flat yellow for hosting. See specs/venue-dashboard.md §9.4.
const BUSKING_COLOR = "#38BDF8";
const NON_BUSKING_COLOR = "#F472B6";
const HOSTING_COLOR = "#FACC15";

export default function AddShowForm({ onSubmit, onClose }: AddShowFormProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [buskingSpots, setBuskingSpots] = useState("0");
  const [buskingIsFree, setBuskingIsFree] = useState(true);
  const [buskingPrice, setBuskingPrice] = useState("");

  const [nonBuskingSpots, setNonBuskingSpots] = useState("0");
  const [nonBuskingIsFree, setNonBuskingIsFree] = useState(true);
  const [nonBuskingPrice, setNonBuskingPrice] = useState("");

  const [hosting, setHosting] = useState(false);
  const [hostingIsFree, setHostingIsFree] = useState(true);
  const [hostingPrice, setHostingPrice] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date || !startTime || !endTime) {
      setError("Date, start time, and end time are required");
      return;
    }

    const busking = Number(buskingSpots);
    const nonBusking = Number(nonBuskingSpots);
    if (!Number.isInteger(busking) || busking < 0 || busking > 100) {
      setError("Busking spots must be a whole number between 0 and 100");
      return;
    }
    if (!Number.isInteger(nonBusking) || nonBusking < 0 || nonBusking > 100) {
      setError("Non-Busking spots must be a whole number between 0 and 100");
      return;
    }
    if (busking === 0 && nonBusking === 0 && !hosting) {
      setError("Add at least one busking, non-busking, or hosting spot");
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit({
      date,
      start_time: startTime,
      end_time: endTime,
      busking: { spots: busking, price: buskingIsFree ? null : Number(buskingPrice) || 0 },
      non_busking: { spots: nonBusking, price: nonBuskingIsFree ? null : Number(nonBuskingPrice) || 0 },
      hosting: { enabled: hosting, price: hosting && !hostingIsFree ? Number(hostingPrice) || 0 : null },
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create show");
      return;
    }

    onClose();
  }

  return (
    <SpotFormModal onClose={onClose}>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-5 pl-3 pr-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-white"
        >
          <IconClose className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
            Add New Show
          </h2>
          <p className="mt-0.5 text-sm text-zinc-400">Set the details for this show.</p>
        </div>
      </div>

      <form className="flex flex-col gap-6 px-6 pb-6 pt-5" onSubmit={handleSubmit}>
        <DateTimeField id="add-show-date" type="date" label="Date" value={date} onChange={setDate} />

        <div className="grid grid-cols-2 gap-4">
          <DateTimeField id="add-show-start" type="time" label="Start time" value={startTime} onChange={setStartTime} />
          <DateTimeField id="add-show-end" type="time" label="End time" value={endTime} onChange={setEndTime} />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <PoolLabel color={BUSKING_COLOR}>Busking</PoolLabel>
          <NumberField
            id="add-show-busking-spots"
            label="Number of spots"
            value={buskingSpots}
            onChange={setBuskingSpots}
            min={0}
            max={100}
          />
          <PriceField
            idPrefix="add-show-busking"
            isFree={buskingIsFree}
            price={buskingPrice}
            setIsFree={setBuskingIsFree}
            setPrice={setBuskingPrice}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <PoolLabel color={NON_BUSKING_COLOR}>Non-Busking</PoolLabel>
          <NumberField
            id="add-show-non-busking-spots"
            label="Number of spots"
            value={nonBuskingSpots}
            onChange={setNonBuskingSpots}
            min={0}
            max={100}
          />
          <PriceField
            idPrefix="add-show-non-busking"
            isFree={nonBuskingIsFree}
            price={nonBuskingPrice}
            setIsFree={setNonBuskingIsFree}
            setPrice={setNonBuskingPrice}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <PoolLabel color={HOSTING_COLOR}>Hosting</PoolLabel>
          <div className="flex items-center gap-5">
            <ToggleCta selected={hosting} variant="hosting" onClick={() => setHosting(true)}>
              Yes
            </ToggleCta>
            <ToggleCta selected={!hosting} onClick={() => setHosting(false)}>
              No
            </ToggleCta>
          </div>
          {hosting ? (
            <PriceField
              idPrefix="add-show-hosting"
              isFree={hostingIsFree}
              price={hostingPrice}
              setIsFree={setHostingIsFree}
              setPrice={setHostingPrice}
            />
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="mt-1 flex justify-center">
          <CtaButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Show"}
          </CtaButton>
        </div>
      </form>
    </SpotFormModal>
  );
}
