"use client";

import { useRouter } from "next/navigation";

import type { PoolType, SpotRequestStatus } from "@repo/types";

import CtaButton from "@/components/CtaButton";

interface SpotRequestCardProps {
  venueName: string;
  venueId?: string | null;
  date: string;
  startTime: string;
  spotType: PoolType;
  status: SpotRequestStatus;
  venueMessage?: string | null;
  editNotice?: string | null;
  onCancel?: () => void;
  isCancelling?: boolean;
}

const STATUS_LABEL: Partial<Record<SpotRequestStatus, string>> = {
  pending: "Waiting for Confirmation",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  cancelled_by_venue: "Cancelled by Venue",
};

const STATUS_COLOR: Partial<Record<SpotRequestStatus, string>> = {
  pending: "#facc15",
  accepted: "#4ade80",
  waitlisted: "#e4e4e7",
  cancelled_by_venue: "#f87171",
};

function formatOrdinalDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleDateString(undefined, { month: "long" });
  return `${day}${suffix} ${month}`;
}

function formatTime12h(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export default function SpotRequestCard({
  venueName,
  venueId,
  date,
  startTime,
  spotType,
  status,
  venueMessage,
  editNotice,
  onCancel,
  isCancelling = false,
}: SpotRequestCardProps) {
  const router = useRouter();
  const canCancel =
    (status === "pending" || status === "accepted" || status === "waitlisted") && Boolean(onCancel);

  function handleViewVenue() {
    if (venueId) {
      router.push(`/venues/${venueId}`);
    }
  }

  return (
    <div
      className="content-glass relative flex flex-col overflow-hidden rounded-2xl"
      style={{ backdropFilter: "blur(40px) saturate(120%)", WebkitBackdropFilter: "blur(40px) saturate(120%)" }}
    >
      {/* Main stub: the "ticket" itself */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 p-5">
        <p
          className="font-[family-name:var(--font-bebas)] uppercase leading-[0.95] text-white"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.4rem)", letterSpacing: "1px" }}
        >
          {venueName}
        </p>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-zinc-300">
          <span>{formatOrdinalDate(date)}</span>
          <span className="text-zinc-600">&middot;</span>
          <span>{formatTime12h(startTime)}</span>
          <span className="text-zinc-600">&middot;</span>
          <span>{spotType === "busking" ? "Busking" : spotType === "hosting" ? "Hosting" : "Non-Busking"}</span>
        </div>

        {venueMessage ? <p className="text-xs text-zinc-400">Note: {venueMessage}</p> : null}
        {editNotice ? <p className="text-xs text-[#38bdf8]">{editNotice}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
          {/* min-h-[44px] gives each button a ≥44px touch target without
              boxing the `.cta` element itself (shared across other pages) —
              see specs/spot-card-mobile-fix-progress.md. */}
          <span className="inline-flex min-h-[44px] items-center">
            <CtaButton onClick={handleViewVenue} disabled={!venueId}>
              View Venue
            </CtaButton>
          </span>

          {canCancel ? (
            <span className="inline-flex min-h-[44px] items-center">
              <CtaButton onClick={onCancel} disabled={isCancelling}>
                {isCancelling ? "Cancelling…" : "Cancel Spot"}
              </CtaButton>
            </span>
          ) : null}
        </div>
      </div>

      {/* Perforated tear-off: the status stub, now a horizontal bottom
          bar instead of a side column. */}
      <div className="flex w-full flex-shrink-0 items-center justify-center border-t border-dashed border-white/20 px-5 py-5">
        <span
          className="font-[family-name:var(--font-bebas)] text-xs uppercase tracking-[0.25em]"
          style={{ color: STATUS_COLOR[status] ?? "#e4e4e7" }}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
    </div>
  );
}
