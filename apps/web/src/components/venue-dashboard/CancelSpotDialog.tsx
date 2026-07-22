"use client";

import { useState } from "react";

interface CancelSpotDialogProps {
  onConfirm: (message?: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export default function CancelSpotDialog({ onConfirm, onClose }: CancelSpotDialogProps) {
  const [message, setMessage] = useState("");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="content-glass w-full max-w-md rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white">Cancel this spot?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          All comedians with a pending, accepted, or waitlisted request will be notified. This
          cannot be undone.
        </p>

        <label className="mb-1 mt-4 block text-xs font-semibold text-zinc-400">
          Message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='Defaults to "Spot canceled by venue"'
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#38bdf8]/60"
        />

        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 rounded-xl border border-red-800 bg-red-900/40 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
          >
            {isSubmitting ? "Cancelling…" : "Cancel Spot"}
          </button>
        </div>
      </div>
    </div>
  );
}
