"use client";

import { useState } from "react";

import { useSpotRequests, type SpotRequestRow } from "@/hooks/useSpotRequests";
import { IconClose } from "@/components/icons/NavIcons";

interface RequestsPanelProps {
  spotId: string;
  spotAvailableSpots: number;
  onClose: () => void;
}

type SectionStatus = "pending" | "accepted" | "waitlisted";

const STATUS_SPINE: Record<SectionStatus, string> = {
  pending: "#facc15",
  accepted: "#38bdf8",
  waitlisted: "#a1a1aa",
};

function RequestCard({
  request,
  status,
  actionLabel,
  onAction,
  disabled,
  showMessageInput,
  variant = "primary",
}: {
  request: SpotRequestRow;
  status: SectionStatus;
  actionLabel?: string;
  onAction?: (message: string) => void;
  disabled?: boolean;
  showMessageInput?: boolean;
  variant?: "primary" | "danger";
}) {
  const [message, setMessage] = useState("");

  return (
    <div
      className="border border-white/10 p-3.5"
      style={{ backgroundColor: "rgba(255,255,255,0.045)" }}
    >
      <p className="text-sm font-semibold text-white">{request.comedian_name ?? "Comedian"}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Requested {new Date(request.requested_at).toLocaleString()}
      </p>
      {request.venue_message ? (
        <p className="mt-1 text-xs text-zinc-400">Note: {request.venue_message}</p>
      ) : null}
      {onAction ? (
        <div
          className="mt-3 flex flex-col gap-2 border-t border-dashed pt-3"
          style={{ borderColor: `${STATUS_SPINE[status]}55` }}
        >
          {showMessageInput ? (
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message"
              className="min-h-[44px] w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-[#38bdf8]/60"
            />
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction(message)}
            className={
              variant === "danger"
                ? "min-h-[44px] w-full rounded-lg border border-red-800 bg-red-900/40 px-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
                : "min-h-[44px] w-full rounded-lg bg-[#38bdf8] px-2 text-xs font-bold text-white transition-colors hover:bg-[#0ea5e9] disabled:opacity-50"
            }
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({ status, children }: { status: SectionStatus; children: React.ReactNode }) {
  return (
    <h3 className="relative mb-3 pl-3 font-[family-name:var(--font-bebas)] text-base uppercase tracking-[0.08em] text-zinc-200">
      <span
        aria-hidden="true"
        className="absolute bottom-0.5 left-0 top-0.5 w-[3px] rounded-full"
        style={{ backgroundColor: STATUS_SPINE[status] }}
      />
      {children}
    </h3>
  );
}

export default function RequestsPanel({ spotId, spotAvailableSpots, onClose }: RequestsPanelProps) {
  const { requests, isLoading, acceptRequest, cancelRequest } = useSpotRequests(spotId);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAccept(requestId: string, message: string) {
    setPendingActionId(requestId);
    setError("");
    const result = await acceptRequest(requestId, message || undefined);
    if (!result.success) {
      setError(result.error ?? "Failed to accept request");
    }
    setPendingActionId(null);
  }

  async function handleCancel(requestId: string, message: string) {
    setPendingActionId(requestId);
    setError("");
    const result = await cancelRequest(requestId, message || undefined);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel request");
    }
    setPendingActionId(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 lg:left-[var(--sidebar-w)]">
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.14] p-6"
        style={{
          backgroundColor: "rgba(24,24,27,0.94)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
            Requests
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 transition-colors hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        {isLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <SectionHeading status="pending">Pending ({requests.pending.length})</SectionHeading>
              {requests.pending.length === 0 ? (
                <p className="pl-3 text-xs text-zinc-500">No pending requests.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.pending.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      status="pending"
                      actionLabel={pendingActionId === r.id ? "Accepting…" : "Accept"}
                      disabled={pendingActionId === r.id || spotAvailableSpots <= 0}
                      showMessageInput
                      onAction={(message) => handleAccept(r.id, message)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionHeading status="accepted">Accepted ({requests.accepted.length})</SectionHeading>
              {requests.accepted.length === 0 ? (
                <p className="pl-3 text-xs text-zinc-500">No accepted requests yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.accepted.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      status="accepted"
                      actionLabel={pendingActionId === r.id ? "Cancelling…" : "Cancel"}
                      disabled={pendingActionId === r.id}
                      showMessageInput
                      variant="danger"
                      onAction={(message) => handleCancel(r.id, message)}
                    />
                  ))}
                </div>
              )}
            </div>

            {requests.waitlisted.length > 0 ? (
              <div>
                <SectionHeading status="waitlisted">Waitlisted ({requests.waitlisted.length})</SectionHeading>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.waitlisted.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      status="waitlisted"
                      actionLabel={pendingActionId === r.id ? "Promoting…" : "Promote"}
                      disabled={pendingActionId === r.id || spotAvailableSpots <= 0}
                      showMessageInput={false}
                      onAction={(message) => handleAccept(r.id, message)}
                    />
                  ))}
                </div>
                {spotAvailableSpots <= 0 ? (
                  <p className="mt-2 pl-3 text-[11px] text-zinc-500">
                    Promote unlocks once a confirmed spot is cancelled.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
