"use client";

import { useState } from "react";

import { useSpotRequests, type SpotRequestRow } from "@/hooks/useSpotRequests";
import { IconClose } from "@/components/icons/NavIcons";
import CtaButton from "@/components/CtaButton";
import { formatDateTimeOrdinal, formatSpotDate, formatTime12h } from "@/lib/formatDate";

interface RequestsPanelProps {
  spotId: string;
  spotAvailableSpots: number;
  spotDate: string;
  spotStartTime: string;
  spotEndTime: string;
  onClose: () => void;
}

type SectionStatus = "pending" | "accepted" | "waitlisted";

const STATUS_SPINE: Record<SectionStatus, string> = {
  pending: "#facc15",
  accepted: "#38bdf8",
  waitlisted: "#a1a1aa",
};

// Solid dark-navy panel fill — the notch on each entry is punched in this
// exact color so it reads as a hole through to the panel behind it.
const PANEL_BG = "rgba(6,12,32,0.97)";
const CARD_BG = "rgba(19,30,58,0.92)";

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
      className="notch-entry rounded-xl py-3.5 pl-5 pr-3.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]"
      style={
        {
          backgroundColor: CARD_BG,
          "--notch-bg": PANEL_BG,
        } as React.CSSProperties
      }
    >
      <p className="text-base font-bold tracking-tight text-white">
        {request.comedian_name ?? "Comedian"}
      </p>
      <p className="mt-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
        Requested {formatDateTimeOrdinal(request.requested_at)}
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
            <div className="float-field">
              <input
                id={`request-message-${request.id}`}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="float-input"
                placeholder=" "
              />
              <label className="float-label" htmlFor={`request-message-${request.id}`}>
                Optional message
              </label>
              <span className="float-bar" aria-hidden="true" />
            </div>
          ) : null}
          <CtaButton
            type="button"
            disabled={disabled}
            variant={variant === "danger" ? "danger" : "default"}
            className="min-h-[44px] w-full justify-center"
            onClick={() => onAction(message)}
          >
            {actionLabel}
          </CtaButton>
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

export default function RequestsPanel({
  spotId,
  spotAvailableSpots,
  spotDate,
  spotStartTime,
  spotEndTime,
  onClose,
}: RequestsPanelProps) {
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
    <div className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-lg lg:left-[var(--sidebar-w)]">
      <div
        className="surface-grain max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.08] p-6"
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              Requests
            </h2>
            <p className="mt-0.5 font-[family-name:var(--font-bebas)] text-sm uppercase tracking-[0.12em] text-zinc-400">
              {formatSpotDate(spotDate)} &middot; {formatTime12h(spotStartTime)} &ndash; {formatTime12h(spotEndTime)}
            </p>
          </div>
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
