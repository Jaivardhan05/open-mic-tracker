"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CtaButton from "@/components/CtaButton";
import { IconClose, IconWarning } from "@/components/icons/NavIcons";

interface SwapConfirmDialogProps {
  comedianName: string;
  /** The spot type the comedian is already accepted for, e.g. "busking". */
  acceptedSpotLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// Same visual shell as CancelShowDialog (solid dark-navy glass panel). The
// accessibility behaviour below (dialog role, focus trap, Escape, focus
// restore) is local to this dialog.
const PANEL_BG = "rgba(6,12,32,0.97)";
const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function SwapConfirmDialog({
  comedianName,
  acceptedSpotLabel,
  onConfirm,
  onClose,
}: SwapConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLSpanElement>(null);
  // Synchronous guard: state-based `disabled` alone can lose to a fast
  // double-click that lands before React re-renders.
  const submitLockRef = useRef(false);
  const isSubmittingRef = useRef(false);
  // Latest onClose without re-running the focus/keydown effect on each parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.querySelector<HTMLElement>("button")?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!isSubmittingRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  async function handleConfirm() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      submitLockRef.current = false;
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    // The dialog sits inside the Requests panel overlay; don't close that too.
    e.stopPropagation();
    if (!isSubmittingRef.current) onClose();
  }

  // Portalled to <body>: RequestsPanel's root has its own backdrop-filter, which
  // makes it the containing block for `fixed` descendants. Rendered inside it,
  // this overlay's top-14 / left-[sidebar-w] offsets were applied a second time
  // (leaving a sharp strip of the panel uncovered), and <main>'s stacking
  // context kept the navbar and sidebar above it. At <body> level the overlay
  // is viewport-sized and above the navbar (z-60) and mobile menu (z-70).
  // The padding re-centres the box over the same content area the panel uses.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 pt-[4.5rem] backdrop-blur-lg lg:pl-[calc(var(--sidebar-w)_+_1rem)]"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-confirm-title"
        aria-describedby="swap-confirm-body"
        className="surface-grain w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08]"
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-5 pl-5 pr-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-full w-[3px] self-stretch rounded-full bg-[#facc15]/70" aria-hidden="true" />
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#facc15]/25 bg-[#facc15]/10 text-[#facc15]">
              <IconWarning className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="swap-confirm-title"
                className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white"
              >
                Swap this comedian&apos;s spot?
              </h2>
              <p id="swap-confirm-body" className="mt-1 text-sm leading-relaxed text-zinc-400">
                {comedianName} is already accepted for {acceptedSpotLabel}. Accepting this will cancel that
                spot and move their {acceptedSpotLabel} request back to the waiting list. Continue?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-8 px-6 pb-6 pt-5">
          {/* .cta removes the outline and has no :focus-visible style, so the
              keyboard focus ring lives on the wrapper (has-[:focus-visible]). */}
          <span
            ref={cancelRef}
            className="inline-flex min-h-[44px] items-center rounded-md ring-red-400/70 ring-offset-2 ring-offset-[#060c20] has-[:focus-visible]:ring-2"
          >
            <CtaButton type="button" variant="danger" disabled={isSubmitting} onClick={onClose}>
              Cancel
            </CtaButton>
          </span>
          <span className="inline-flex min-h-[44px] items-center rounded-md ring-[#38bdf8]/70 ring-offset-2 ring-offset-[#060c20] has-[:focus-visible]:ring-2">
            <CtaButton type="button" disabled={isSubmitting} onClick={handleConfirm}>
              {isSubmitting ? "Swapping…" : "Confirm"}
            </CtaButton>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
