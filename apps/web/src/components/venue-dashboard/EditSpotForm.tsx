"use client";

import { useState } from "react";

import type { Spot } from "@repo/types";

import type { EditSpotInput } from "@/hooks/useVenueSpots";
import CtaButton from "@/components/CtaButton";
import { IconClose } from "@/components/icons/NavIcons";
import { useToast } from "@/context/ToastContext";

import { DateTimeField, NumberField, SpotFormModal, ToggleCta } from "./SpotFormShared";

interface EditSpotFormProps {
  spot: Spot;
  onSubmit: (spotId: string, input: EditSpotInput) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

// Editable fields, per spec: total spots, price, date, busking/non-busking
// type. Start/end time are not editable here (not part of the request) —
// styling and modal shell are lifted from AddSpotForm via SpotFormShared so
// this never forks the panel/field/toggle look. See specs/venue-dashboard.md §5.4.
export default function EditSpotForm({ spot, onSubmit, onClose }: EditSpotFormProps) {
  const { showToast } = useToast();
  const [date, setDate] = useState(spot.date);
  const [totalSpots, setTotalSpots] = useState(String(spot.total_spots));
  const [spotType, setSpotType] = useState<"busking" | "non_busking">(spot.spot_type);
  const [isFree, setIsFree] = useState(!spot.price);
  const [price, setPrice] = useState(spot.price ? String(spot.price) : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date) {
      setError("Date is required");
      return;
    }

    const total = Number(totalSpots);
    if (!Number.isInteger(total) || total <= 0) {
      setError("Total spots must be a positive whole number");
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(spot.id, {
      date,
      spot_type: spotType,
      total_spots: total,
      price: isFree ? null : Number(price) || 0,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to update spot");
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
            Edit Spot
          </h2>
          <p className="mt-0.5 text-sm text-zinc-400">Update the details for this open mic slot.</p>
        </div>
      </div>

      <form className="flex flex-col gap-5 px-6 pb-6 pt-5" onSubmit={handleSubmit}>
        <DateTimeField id="edit-spot-date" type="date" label="Date" value={date} onChange={setDate} />

        <NumberField
          id="edit-spot-total"
          label="Total spots available"
          value={totalSpots}
          onChange={setTotalSpots}
          min={1}
          max={100}
        />

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Type</p>
          <div className="flex items-center gap-5">
            <ToggleCta selected={spotType === "non_busking"} onClick={() => setSpotType("non_busking")}>
              Non-Busking
            </ToggleCta>
            <ToggleCta selected={spotType === "busking"} variant="busking" onClick={() => setSpotType("busking")}>
              Busking
            </ToggleCta>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Price</p>
          <div className="flex items-end gap-5">
            <ToggleCta selected={isFree} variant="free" onClick={() => setIsFree(true)}>
              Free
            </ToggleCta>
            <div className="flex-1">
              <NumberField
                id="edit-spot-price"
                label="Amount"
                prefix="₹"
                value={price}
                onFocus={() => setIsFree(false)}
                onChange={(v) => {
                  setIsFree(false);
                  setPrice(v);
                }}
                min={0}
                placeholder="0"
              />
            </div>
          </div>
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
