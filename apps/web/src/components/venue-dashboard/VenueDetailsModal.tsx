"use client";

import { useRef, useState } from "react";

import type { OwnerVenueStatus } from "@repo/types";

import CtaButton from "@/components/CtaButton";
import ModalShell from "@/components/ModalShell";
import ReasonNote from "@/components/admin/ReasonNote";
import StatusIcon from "@/components/admin/StatusIcons";
import type { VenueDetailsInput } from "@/hooks/useOwnerVenueStatus";
import { STATUS_META } from "@/lib/venueStatus";

const NAME_MIN = 2;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;

export type VenueDetailsMode = "resubmit" | "edit";

interface VenueDetailsModalProps {
  status: OwnerVenueStatus;
  /** "resubmit": fix what the admin asked for and send it back. "edit": save only (venue is still pending). */
  mode: VenueDetailsMode;
  onSave: (input: VenueDetailsInput) => Promise<{ success: boolean; error?: string }>;
  onResubmit: () => Promise<{ success: boolean; error?: string }>;
  /** Called after everything succeeded; the parent refreshes and closes. */
  onDone: (result: { mode: VenueDetailsMode; saved: VenueDetailsInput }) => void;
  onClose: () => void;
}

export default function VenueDetailsModal({
  status,
  mode,
  onSave,
  onResubmit,
  onDone,
  onClose,
}: VenueDetailsModalProps) {
  const statusKey = mode === "resubmit" ? "changes_requested" : "pending";
  const { color } = STATUS_META[statusKey];

  const [baseline, setBaseline] = useState<VenueDetailsInput>({
    name: status.name,
    city: status.city,
    description: status.description ?? "",
  });
  const [name, setName] = useState(baseline.name);
  const [city, setCity] = useState(baseline.city);
  const [description, setDescription] = useState(baseline.description);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // The select must always offer the venue's current city, even when it is
  // outside the standard list.
  const cities = status.allowed_cities.includes(status.city)
    ? status.allowed_cities
    : [status.city, ...status.allowed_cities];

  const trimmedName = name.trim();
  const nameOk = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX;
  const descriptionOk = description.length <= DESCRIPTION_MAX;
  const dirty =
    trimmedName !== baseline.name || city !== baseline.city || description.trim() !== baseline.description;
  // Resubmitting is allowed with no edits (the owner may just be replying to
  // the note); a plain save needs a change.
  const canSubmit = !isSubmitting && nameOk && descriptionOk && (mode === "resubmit" || dirty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || !canSubmit) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setError("");

    const next: VenueDetailsInput = { name: trimmedName, city, description: description.trim() };
    let savedSomething = false;

    if (dirty) {
      const saved = await onSave(next);
      if (!saved.success) {
        setError(saved.error ?? "Couldn't save your changes.");
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
      setBaseline(next);
      savedSomething = true;
    }

    if (mode === "resubmit") {
      const resubmitted = await onResubmit();
      if (!resubmitted.success) {
        setError(
          `${savedSomething ? "Your changes were saved, but " : ""}${
            resubmitted.error ?? "we couldn't resubmit your venue."
          }${savedSomething ? " Press the button again to retry." : ""}`
        );
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
    }

    onDone({ mode, saved: next });
  }

  return (
    <ModalShell
      title={mode === "resubmit" ? "Fix and resubmit" : "Edit venue details"}
      subtitle={status.name}
      spineColor={color}
      leading={
        <span
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
        >
          <StatusIcon status={statusKey} className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
      dismissible={!isSubmitting}
      maxWidthClass="max-w-lg"
    >
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        {mode === "resubmit"
          ? "Update what the team asked for, then send your venue back for review. Your venue stays off /venues until it's approved."
          : "Your venue is in the review queue. You can still correct these details while you wait."}
      </p>

      {mode === "resubmit" ? (
        <ReasonNote
          reason={status.review_reason}
          color={color}
          caption="What the team asked for"
          className="mt-4"
        />
      ) : null}

      <form className="mt-5 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div>
          <div className="float-field">
            <input
              id="venue-details-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=" "
              maxLength={NAME_MAX + 20}
              autoComplete="off"
              className="float-input"
              aria-invalid={!nameOk}
            />
            <label className="float-label" htmlFor="venue-details-name">
              Venue name
            </label>
            <span className="float-bar" aria-hidden="true" />
          </div>
          {!nameOk ? (
            <p className="mt-1 text-[11px] text-red-400">
              Use {NAME_MIN}-{NAME_MAX} characters.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="venue-details-city"
            className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500"
          >
            City
          </label>
          <select
            id="venue-details-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="float-input mt-1"
          >
            {cities.map((c) => (
              <option key={c} value={c} className="bg-zinc-900 text-white">
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="float-field">
            <textarea
              id="venue-details-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=" "
              rows={3}
              className="float-input resize-none"
              aria-describedby="venue-details-description-count"
            />
            <label className="float-label" htmlFor="venue-details-description">
              Description
            </label>
            <span className="float-bar" aria-hidden="true" />
          </div>
          <p
            id="venue-details-description-count"
            className={`mt-1 text-right text-[11px] ${descriptionOk ? "text-zinc-600" : "text-red-400"}`}
          >
            {description.length}/{DESCRIPTION_MAX}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-center">
          <CtaButton type="submit" disabled={!canSubmit}>
            {isSubmitting
              ? "Sending…"
              : mode === "resubmit"
                ? "Resubmit for review"
                : "Save changes"}
          </CtaButton>
        </div>
      </form>
    </ModalShell>
  );
}
