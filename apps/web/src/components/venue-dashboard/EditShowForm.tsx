"use client";

import { useState } from "react";

import type { VenueShow } from "@repo/types";

import type { EditShowInput } from "@/hooks/useVenueShows";
import CtaButton from "@/components/CtaButton";
import { IconClose } from "@/components/icons/NavIcons";
import { useToast } from "@/context/ToastContext";

import { DateTimeField, NumberField, PoolLabel, PriceField, SpotFormModal, ToggleCta } from "./SpotFormShared";

interface EditShowFormProps {
  show: VenueShow;
  onSubmit: (showId: string, input: EditShowInput) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

const BUSKING_COLOR = "#38BDF8";
const NON_BUSKING_COLOR = "#F472B6";
const HOSTING_COLOR = "#FACC15";

// Editable fields, per spec: each pool's spot count + price, plus date.
// Start/end time are not editable here (not part of the request) — styling
// and modal shell are lifted from AddShowForm via SpotFormShared so this
// never forks the panel/field/toggle look. See specs/venue-dashboard.md §9.4.
export default function EditShowForm({ show, onSubmit, onClose }: EditShowFormProps) {
  const { showToast } = useToast();
  const [date, setDate] = useState(show.date);

  const [buskingSpots, setBuskingSpots] = useState(String(show.busking?.total_spots ?? 0));
  const [buskingIsFree, setBuskingIsFree] = useState(!show.busking?.price);
  const [buskingPrice, setBuskingPrice] = useState(show.busking?.price ? String(show.busking.price) : "");

  const [nonBuskingSpots, setNonBuskingSpots] = useState(String(show.non_busking?.total_spots ?? 0));
  const [nonBuskingIsFree, setNonBuskingIsFree] = useState(!show.non_busking?.price);
  const [nonBuskingPrice, setNonBuskingPrice] = useState(show.non_busking?.price ? String(show.non_busking.price) : "");

  const [hosting, setHosting] = useState(Boolean(show.hosting));
  const [hostingIsFree, setHostingIsFree] = useState(!show.hosting?.price);
  const [hostingPrice, setHostingPrice] = useState(show.hosting?.price ? String(show.hosting.price) : "");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date) {
      setError("Date is required");
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
      setError("Keep at least one busking, non-busking, or hosting spot");
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(show.id, {
      date,
      busking: { spots: busking, price: buskingIsFree ? null : Number(buskingPrice) || 0 },
      non_busking: { spots: nonBusking, price: nonBuskingIsFree ? null : Number(nonBuskingPrice) || 0 },
      hosting: { enabled: hosting, price: hosting && !hostingIsFree ? Number(hostingPrice) || 0 : null },
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to update show");
      return;
    }

    showToast("Changes saved successfully!");
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
            Edit Show
          </h2>
          <p className="mt-0.5 text-sm text-zinc-400">Update the details for this show.</p>
        </div>
      </div>

      <form className="flex flex-col gap-6 px-6 pb-6 pt-5" onSubmit={handleSubmit}>
        <DateTimeField id="edit-show-date" type="date" label="Date" value={date} onChange={setDate} />

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <PoolLabel color={BUSKING_COLOR}>Busking</PoolLabel>
          <NumberField
            id="edit-show-busking-spots"
            label="Number of spots"
            value={buskingSpots}
            onChange={setBuskingSpots}
            min={0}
            max={100}
          />
          <PriceField
            idPrefix="edit-show-busking"
            isFree={buskingIsFree}
            price={buskingPrice}
            setIsFree={setBuskingIsFree}
            setPrice={setBuskingPrice}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          <PoolLabel color={NON_BUSKING_COLOR}>Non-Busking</PoolLabel>
          <NumberField
            id="edit-show-non-busking-spots"
            label="Number of spots"
            value={nonBuskingSpots}
            onChange={setNonBuskingSpots}
            min={0}
            max={100}
          />
          <PriceField
            idPrefix="edit-show-non-busking"
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
              idPrefix="edit-show-hosting"
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
            {isSubmitting ? "Saving…" : "Save Changes"}
          </CtaButton>
        </div>
      </form>
    </SpotFormModal>
  );
}
