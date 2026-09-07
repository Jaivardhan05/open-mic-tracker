"use client";

import { useEffect, useState } from "react";

import type { ToastVariant } from "@/context/ToastContext";
import { IconCheck } from "@/components/icons/NavIcons";

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

// Timings match specs/toast-notification-spec.md: enter (320ms, overshoot
// ease) -> hold (2.6s) -> exit (220ms, no overshoot). Managed here, not in
// ToastProvider, so the whole lifecycle lives in one file.
const HOLD_MS = 2600;
const EXIT_MS = 220;

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: "#34d399",
};

export default function Toast({ message, variant, onDismiss }: ToastProps) {
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const accent = VARIANT_ACCENT[variant];

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase("exit"), HOLD_MS);
    return () => clearTimeout(exitTimer);
  }, []);

  useEffect(() => {
    if (phase !== "exit") return;
    const dismissTimer = setTimeout(onDismiss, EXIT_MS);
    return () => clearTimeout(dismissTimer);
  }, [phase, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setPhase("exit")}
      className={`surface-grain pointer-events-auto flex cursor-pointer items-stretch overflow-hidden rounded-2xl border border-white/[0.08] ${
        phase === "enter" ? "toast-in" : "toast-out"
      }`}
      style={{
        backgroundColor: "rgba(6,12,32,0.94)",
        backdropFilter: "blur(40px) saturate(140%)",
        WebkitBackdropFilter: "blur(40px) saturate(140%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 40px -12px rgba(0,0,0,0.65)",
      }}
    >
      {/* Status spine — same left-edge idiom as VenueSpotCard's meter spine
          and CancelSpotDialog's warning spine, recolored to the site's one
          established green (.cta-free). */}
      <span aria-hidden="true" className="w-[3px] flex-shrink-0" style={{ backgroundColor: accent }} />

      <div className="flex items-center gap-2.5 py-2.5 pl-3 pr-5">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <IconCheck className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-medium text-white">{message}</p>
      </div>
    </div>
  );
}
