"use client";

import { useRef, useState } from "react";

import CtaButton from "@/components/CtaButton";
import ModalShell from "@/components/ModalShell";
import { STATUS_META } from "@/lib/venueStatus";

import ReasonNote from "./ReasonNote";
import StatusIcon from "./StatusIcons";

export type ReviewActionKind = "approve" | "request_changes" | "reject";

export const REVIEW_REASON_MAX = 500;

interface ReviewActionModalProps {
  kind: ReviewActionKind;
  venueName: string;
  onConfirm: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

const COPY: Record<
  ReviewActionKind,
  {
    title: string;
    status: "approved" | "changes_requested" | "rejected";
    body: (name: string) => string;
    fieldLabel?: string;
    notePrompt?: string;
    cta: string;
    busy: string;
    variant: "default" | "danger";
  }
> = {
  approve: {
    title: "Approve venue",
    status: "approved",
    body: (name) => `${name} goes live: it appears on /venues and its owner can start adding shows.`,
    cta: "Approve",
    busy: "Approving…",
    variant: "default",
  },
  request_changes: {
    title: "Request changes",
    status: "changes_requested",
    body: (name) =>
      `${name} stays off /venues and can't add shows until its owner fixes what you list here and resubmits. They'll see your note on their dashboard.`,
    fieldLabel: "What needs fixing",
    notePrompt: "The owner will read",
    cta: "Send request",
    busy: "Sending…",
    variant: "default",
  },
  reject: {
    title: "Reject venue",
    status: "rejected",
    body: (name) =>
      `${name} stays off /venues and can't add shows. Its owner sees your reason and is pointed to support. They can't resubmit.`,
    fieldLabel: "Reason for rejection",
    notePrompt: "The owner will read",
    cta: "Reject venue",
    busy: "Rejecting…",
    variant: "danger",
  },
};

export default function ReviewActionModal({ kind, venueName, onConfirm, onClose }: ReviewActionModalProps) {
  const copy = COPY[kind];
  const needsReason = kind !== "approve";
  const { color } = STATUS_META[copy.status];

  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous guard: state-based `disabled` can lose to a fast double-click.
  const submitLockRef = useRef(false);

  const trimmed = reason.trim();
  const tooLong = reason.length > REVIEW_REASON_MAX;
  const canSubmit = !isSubmitting && (!needsReason || (trimmed !== "" && !tooLong));

  async function handleConfirm() {
    if (submitLockRef.current || !canSubmit) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setError("");
    const result = await onConfirm(needsReason ? trimmed : undefined);
    if (!result.success) {
      setError(result.error ?? "Something went wrong. Try again.");
      setIsSubmitting(false);
      submitLockRef.current = false;
      return;
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
      title={copy.title}
      subtitle={venueName}
      spineColor={color}
      leading={
        <span
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
        >
          <StatusIcon status={copy.status} className="h-4 w-4" />
        </span>
      }
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">{copy.body(venueName)}</p>

      {needsReason ? (
        <div className="mt-5">
          <div className="float-field">
            <textarea
              id="review-action-reason"
              value={reason}
              onChange={handleReasonInput}
              placeholder=" "
              rows={1}
              maxLength={REVIEW_REASON_MAX + 50}
              className="float-input resize-none overflow-hidden"
              aria-describedby="review-action-reason-count"
            />
            <label className="float-label" htmlFor="review-action-reason">
              {copy.fieldLabel}
            </label>
            <span className="float-bar" aria-hidden="true" />
          </div>
          <p
            id="review-action-reason-count"
            className={`mt-1 text-right text-[11px] ${tooLong ? "text-red-400" : "text-zinc-600"}`}
          >
            {reason.length}/{REVIEW_REASON_MAX}
          </p>

          <ReasonNote reason={trimmed} color={color} caption={copy.notePrompt} className="mt-3" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-center">
        <CtaButton type="button" variant={copy.variant} disabled={!canSubmit} onClick={() => void handleConfirm()}>
          {isSubmitting ? copy.busy : copy.cta}
        </CtaButton>
      </div>
    </ModalShell>
  );
}
