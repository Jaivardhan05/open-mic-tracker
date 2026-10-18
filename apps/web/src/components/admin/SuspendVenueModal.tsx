"use client";

import { useEffect, useRef, useState } from "react";

import CtaButton from "@/components/CtaButton";
import ModalShell from "@/components/ModalShell";
import type { SuspendCounts, SuspensionPreview } from "@/hooks/useAdminVenue";
import { STATUS_META } from "@/lib/venueStatus";

import ConfirmByTyping, { matchesTypedWord } from "./ConfirmByTyping";
import ReasonNote from "./ReasonNote";
import StatusIcon from "./StatusIcons";
import { REVIEW_REASON_MAX } from "./ReviewActionModal";

const CONFIRM_WORD = "Suspend";

type PreviewResult = { success: true; preview: SuspensionPreview } | { success: false; error: string };
type SuspendResult = { success: true; counts: SuspendCounts } | { success: false; error: string };

interface SuspendVenueModalProps {
  venueName: string;
  getPreview: () => Promise<PreviewResult>;
  onConfirm: (reason: string) => Promise<SuspendResult>;
  onClose: () => void;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// The one-step-before-the-point-of-no-return modal: what will be cancelled
// (live counts), what unsuspending will NOT undo, a required reason and a
// typed "Suspend". `onConfirm` closes the modal on success.
export default function SuspendVenueModal({ venueName, getPreview, onConfirm, onClose }: SuspendVenueModalProps) {
  const { color } = STATUS_META.suspended;

  const [preview, setPreview] = useState<SuspensionPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous guard: state-based `disabled` can lose to a fast double-click.
  const submitLockRef = useRef(false);
  const getPreviewRef = useRef(getPreview);
  getPreviewRef.current = getPreview;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPreviewError("");
    void getPreviewRef.current().then((result) => {
      if (cancelled) return;
      if (result.success) setPreview(result.preview);
      else setPreviewError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const trimmed = reason.trim();
  const tooLong = reason.length > REVIEW_REASON_MAX;
  const canSubmit = !isSubmitting && trimmed !== "" && !tooLong && matchesTypedWord(typed, CONFIRM_WORD);

  async function handleConfirm() {
    if (submitLockRef.current || !canSubmit) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setError("");
    const result = await onConfirm(trimmed);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
    // Success: the parent closes the modal.
  }

  function handleReasonInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReason(e.target.value);
    // Auto-grow so the underline bar stays under the last typed line.
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <ModalShell
      title="Suspend venue"
      subtitle={venueName}
      spineColor={color}
      leading={
        <span
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
        >
          <StatusIcon status="suspended" className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      <p className="mt-4 text-sm leading-relaxed text-zinc-300">
        <strong className="font-semibold text-white">{venueName}</strong> will be suspended and taken off /venues. Its
        upcoming shows are cancelled, including one that is in progress now (India time), and so are the pending,
        accepted and waitlisted requests on them.
      </p>

      <div className="mt-4 rounded-xl border border-white/10 p-3" aria-live="polite">
        <p className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.12em] text-zinc-500">
          What will be cancelled
        </p>
        {preview ? (
          <p className="mt-1 text-sm text-white">
            {plural(preview.shows, "upcoming show", "upcoming shows")}, {plural(preview.spots, "spot pool", "spot pools")}
            {" and "}
            {plural(preview.requests.total, "request", "requests")} from {plural(preview.comedians, "comedian", "comedians")}
            {preview.requests.total > 0
              ? ` (${preview.requests.pending} pending, ${preview.requests.accepted} accepted, ${preview.requests.waitlisted} waitlisted)`
              : ""}
            .
          </p>
        ) : previewError ? (
          <div className="mt-1">
            <p className="text-sm text-red-400" role="alert">
              {previewError}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-1 min-h-[44px] text-sm text-[#38bdf8] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Counting…</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          A snapshot: it can change before you confirm, and the confirmation shows the final numbers. Bookings made in
          the older booking system are not cancelled.
        </p>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-400">
        <li>Unsuspending restores nothing. Cancelled shows and requests stay cancelled and the owner has to recreate them.</li>
        <li>The owner sees your reason on their dashboard and in Notices from Admin. Comedians see only a neutral message.</li>
        <li>If the venue is hidden, it stays hidden after the suspension is lifted.</li>
        <li>Nothing records that the venue was suspended once it is lifted, so note it elsewhere if you need the history.</li>
      </ul>

      <div className="mt-5">
        <div className="float-field">
          <textarea
            id="suspend-reason"
            value={reason}
            onChange={handleReasonInput}
            placeholder=" "
            rows={1}
            maxLength={REVIEW_REASON_MAX + 50}
            disabled={isSubmitting}
            className="float-input resize-none overflow-hidden"
            aria-describedby="suspend-reason-count"
          />
          <label className="float-label" htmlFor="suspend-reason">
            Why it&apos;s being suspended
          </label>
          <span className="float-bar" aria-hidden="true" />
        </div>
        <p
          id="suspend-reason-count"
          className={`mt-1 text-right text-[11px] ${tooLong ? "text-red-400" : "text-zinc-600"}`}
        >
          {reason.length}/{REVIEW_REASON_MAX}
        </p>
        <ReasonNote reason={trimmed} color={color} caption="The owner will read" className="mt-3" />
      </div>

      <div className="mt-5">
        <ConfirmByTyping id="suspend-confirm" word={CONFIRM_WORD} value={typed} onChange={setTyped} disabled={isSubmitting} />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-center">
        <CtaButton type="button" variant="danger" disabled={!canSubmit} onClick={() => void handleConfirm()}>
          {isSubmitting ? "Suspending…" : "Suspend venue"}
        </CtaButton>
      </div>
    </ModalShell>
  );
}
