"use client";

import { useState } from "react";

import CtaButton from "@/components/CtaButton";
import { IconClose, IconWarning } from "@/components/icons/NavIcons";

interface CancelSpotDialogProps {
  onConfirm: (message?: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

// Matches RequestsPanel's solid dark-navy panel fill.
const PANEL_BG = "rgba(6,12,32,0.97)";

export default function CancelSpotDialog({ onConfirm, onClose }: CancelSpotDialogProps) {
  const [message, setMessage] = useState("");
  const [isMessageFocused, setIsMessageFocused] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    setError("");
    const result = await onConfirm(message.trim() || undefined);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel spot");
      return;
    }
    onClose();
  }

  function handleMessageInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessage(e.target.value);
    // Auto-grow so the underline bar always sits directly under the last
    // typed line instead of at the bottom of a fixed multi-row box.
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-lg lg:left-[var(--sidebar-w)]"
      onClick={onClose}
    >
      <div
        className="surface-grain w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08]"
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Danger spine — mirrors the accepted/pending status spines in RequestsPanel,
            but runs the full height of the card to read as a warning, not a category. */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-5 pl-5 pr-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-full w-[3px] self-stretch rounded-full bg-red-500/70" aria-hidden="true" />
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 text-red-400">
              <IconWarning className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
                Cancel this spot?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                All comedians with a pending, accepted, or waitlisted request will be notified.
                This cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="float-field">
            <textarea
              id="cancel-spot-message"
              value={message}
              onChange={handleMessageInput}
              onFocus={() => setIsMessageFocused(true)}
              onBlur={() => setIsMessageFocused(false)}
              placeholder={isMessageFocused ? 'Defaults to "Spot canceled by venue" if left blank.' : " "}
              rows={1}
              className="float-input cancel-spot-message resize-none overflow-hidden"
            />
            <label className="float-label" htmlFor="cancel-spot-message">
              Message (optional)
            </label>
            <span className="float-bar" aria-hidden="true" />
          </div>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-6 flex justify-center">
            <CtaButton type="button" variant="danger" disabled={isSubmitting} onClick={handleConfirm}>
              {isSubmitting ? "Cancelling…" : "Cancel Spot"}
            </CtaButton>
          </div>
        </div>
      </div>
    </div>
  );
}
