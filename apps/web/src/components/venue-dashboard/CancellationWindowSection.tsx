"use client";

import { useState } from "react";

import type { OwnerVenueStatus } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import {
  CANCEL_CUTOFF_MAX_HOURS,
  CANCEL_CUTOFF_MIN_HOURS,
  describeCutoff,
} from "@/lib/cancelWindow";

interface CancellationWindowSectionProps {
  status: OwnerVenueStatus | null;
  onSave: (hours: number) => Promise<{ success: boolean; error?: string }>;
  onSaved: () => void;
}

const OPTIONS = Array.from(
  { length: CANCEL_CUTOFF_MAX_HOURS - CANCEL_CUTOFF_MIN_HOURS + 1 },
  (_, i) => CANCEL_CUTOFF_MAX_HOURS - i
);

function optionLabel(hours: number): string {
  if (hours === 0) return "Until the show starts (0 hours)";
  if (hours === CANCEL_CUTOFF_MAX_HOURS) return `${hours} hours before (default, longest)`;
  return hours === 1 ? "1 hour before" : `${hours} hours before`;
}

// How long before a show starts a comedian may still cancel an ACCEPTED spot.
// Works in every venue state. The value is copied onto each request when the
// owner accepts it, so changing it never affects spots already accepted. The
// server enforces 0 to 12 whole hours regardless of this control.
export default function CancellationWindowSection({ status, onSave, onSaved }: CancellationWindowSectionProps) {
  // The typed choice; null means "untouched, follow the stored value".
  const [draft, setDraft] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!status) {
    return null;
  }

  const stored = status.cancel_cutoff_hours;
  const value = draft ?? stored;
  const changed = value !== stored;

  async function handleSave() {
    setError("");
    setIsSaving(true);
    const result = await onSave(value);
    setIsSaving(false);
    if (!result.success) {
      setError(result.error ?? "Couldn't save the cancellation window.");
      return;
    }
    setDraft(null);
    onSaved();
  }

  return (
    <section className="mt-8 px-4 md:px-6" aria-labelledby="cancel-window-heading">
      <div className="glass-panel rounded-2xl p-5">
        <h2
          id="cancel-window-heading"
          className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
        >
          Cancellation window
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Comedians can cancel a spot you&apos;ve accepted {describeCutoff(stored)}. After that they can&apos;t
          cancel it themselves and have to contact you.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex min-w-[14rem] flex-col gap-1.5">
            <span className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500">
              Comedians can cancel
            </span>
            <select
              value={value}
              disabled={isSaving}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="min-h-[44px] rounded-xl border border-white/15 bg-zinc-900/80 px-3 text-sm text-white outline-none focus:border-[#38bdf8]"
            >
              {OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {optionLabel(hours)}
                </option>
              ))}
            </select>
          </label>

          <span className="inline-flex min-h-[44px] items-center">
            <CtaButton type="button" disabled={!changed || isSaving} onClick={handleSave}>
              {isSaving ? "Saving…" : "Save"}
            </CtaButton>
          </span>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Applies to spots you accept from now on. Spots you&apos;ve already accepted keep the window they were
          accepted with.
        </p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
