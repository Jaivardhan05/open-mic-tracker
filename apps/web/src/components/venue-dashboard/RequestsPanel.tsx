"use client";

import { useState } from "react";

import { useSpotRequests, type SpotRequestRow } from "@/hooks/useSpotRequests";
import { IconClose } from "@/components/icons/NavIcons";
import CtaButton from "@/components/CtaButton";
import SwapConfirmDialog from "./SwapConfirmDialog";
import { formatDateTimeOrdinal, formatSpotDate, formatTime12h } from "@/lib/formatDate";
import { safeHttpUrl, safeMailto } from "@/lib/safeLinks";
import {
  GmailIcon,
  InstagramIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/profile/flashcards/BrandIcons";

interface RequestsPanelProps {
  spotId: string;
  spotAvailableSpots: number;
  spotDate: string;
  spotStartTime: string;
  spotEndTime: string;
  onClose: () => void;
  /** Called after any accept/cancel attempt so the parent can refresh spot counts. */
  onChanged?: () => void;
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
// Same amber as the pending spine; marks a request whose accept is a swap.
const SWAP_ACCENT = "#facc15";

function spotTypeLabel(spotType: string): string {
  return spotType.replace("_", "-");
}

function RequestCard({
  request,
  status,
  actionLabel,
  onAction,
  disabled,
  showMessageInput,
  variant = "primary",
  blockedBy,
}: {
  request: SpotRequestRow;
  status: SectionStatus;
  actionLabel?: string;
  onAction?: (message: string) => void;
  disabled?: boolean;
  showMessageInput?: boolean;
  variant?: "primary" | "danger";
  blockedBy?: SpotRequestRow["blocked_by"];
}) {
  const [message, setMessage] = useState("");

  const socials = [
    { key: "instagram", href: safeHttpUrl(request.comedian_instagram_url), Icon: InstagramIcon, label: "Instagram" },
    { key: "x", href: safeHttpUrl(request.comedian_x_url), Icon: XIcon, label: "X" },
    { key: "youtube", href: safeHttpUrl(request.comedian_youtube_url), Icon: YouTubeIcon, label: "YouTube" },
    { key: "contact", href: safeMailto(request.comedian_contact_email), Icon: GmailIcon, label: "Email" },
  ] as const;

  return (
    <div
      className="notch-entry rounded-xl py-3.5 pl-5 pr-3.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]"
      style={
        {
          backgroundColor: CARD_BG,
          "--notch-bg": PANEL_BG,
          ...(blockedBy ? { boxShadow: `inset 0 0 0 1px ${SWAP_ACCENT}59` } : {}),
        } as React.CSSProperties
      }
    >
      <p className="text-base font-bold tracking-tight text-white">
        {request.comedian_name ?? "Comedian"}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {socials.map(({ key, href, Icon, label }) =>
          href ? (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-7 w-7 items-center justify-center text-white transition-colors hover:text-[#38bdf8]"
            >
              <Icon className="h-4 w-4" />
            </a>
          ) : (
            <span
              key={key}
              role="img"
              aria-label={`${label} not linked`}
              className="flex h-7 w-7 items-center justify-center text-zinc-700"
            >
              <Icon className="h-4 w-4" />
            </span>
          )
        )}
      </div>
      <p className="mt-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
        Requested {formatDateTimeOrdinal(request.requested_at)}
      </p>
      {request.venue_message ? (
        <p className="mt-1 text-xs text-zinc-400">Note: {request.venue_message}</p>
      ) : null}
      {blockedBy ? (
        <p className="mt-2 text-xs font-semibold" style={{ color: SWAP_ACCENT }}>
          Already accepted for {spotTypeLabel(blockedBy.spot_type)}. Accepting this will cancel that spot.
        </p>
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
  onChanged,
}: RequestsPanelProps) {
  const { requests, isLoading, acceptRequest, cancelRequest } = useSpotRequests(spotId);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [swapTarget, setSwapTarget] = useState<{ request: SpotRequestRow; message: string } | null>(null);

  async function handleAccept(requestId: string, message: string, swapFromRequestId?: string) {
    setPendingActionId(requestId);
    setError("");
    const result = await acceptRequest(requestId, message || undefined, swapFromRequestId);
    if (!result.success) {
      setError(result.error ?? "Failed to accept request");
    }
    setPendingActionId(null);
    onChanged?.();
  }

  // A blocked request goes through the confirmation dialog; a normal one is accepted directly.
  function handleAcceptClick(request: SpotRequestRow, message: string) {
    if (request.blocked_by) {
      setSwapTarget({ request, message });
      return;
    }
    handleAccept(request.id, message);
  }

  async function handleSwapConfirm() {
    if (!swapTarget?.request.blocked_by) return;
    const { request, message } = swapTarget;
    // The server result (or a stale-state message) is shown in the panel's
    // error line, and the list has been refetched either way; then close.
    await handleAccept(request.id, message, request.blocked_by?.request_id);
    setSwapTarget(null);
  }

  async function handleCancel(requestId: string, message: string) {
    setPendingActionId(requestId);
    setError("");
    const result = await cancelRequest(requestId, message || undefined);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel request");
    }
    setPendingActionId(null);
    onChanged?.();
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-lg lg:left-[var(--sidebar-w)]"
      onClick={onClose}
    >
      <div
        className="surface-grain max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.08] p-6"
        style={{
          backgroundColor: PANEL_BG,
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
        }}
        onClick={(e) => e.stopPropagation()}
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
                      blockedBy={r.blocked_by}
                      onAction={(message) => handleAcceptClick(r, message)}
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
                      blockedBy={r.blocked_by}
                      onAction={(message) => handleAcceptClick(r, message)}
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

      {swapTarget?.request.blocked_by ? (
        <SwapConfirmDialog
          comedianName={swapTarget.request.comedian_name ?? "This comedian"}
          acceptedSpotLabel={spotTypeLabel(swapTarget.request.blocked_by.spot_type)}
          onConfirm={handleSwapConfirm}
          onClose={() => setSwapTarget(null)}
        />
      ) : null}
    </div>
  );
}
