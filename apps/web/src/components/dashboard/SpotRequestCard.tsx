"use client";

import { useRouter } from "next/navigation";

import type { SpotRequestStatus } from "@repo/types";

interface SpotRequestCardProps {
  venueName: string;
  venueId?: string | null;
  date: string;
  startTime: string;
  spotType: "busking" | "non_busking";
  status: SpotRequestStatus;
  venueMessage?: string | null;
  onCancel?: () => void;
  isCancelling?: boolean;
}

const STATUS_LABEL: Partial<Record<SpotRequestStatus, string>> = {
  accepted: "Confirmed",
  waitlisted: "Waitlisted",
  cancelled_by_venue: "Cancelled by Venue",
};

const STATUS_COLOR: Partial<Record<SpotRequestStatus, string>> = {
  accepted: "#4ade80",
  waitlisted: "#ffffff",
  cancelled_by_venue: "#d43e3e",
};

const headerTextShadow = "0 3px 10px rgba(248, 249, 250, 0.956)";
const bodyTextShadow = "0 2px 8px rgba(255, 255, 255, 0.768)";
const statusTextShadow = "0 2px 8px #fefbfbeb";

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
  const year = date.getFullYear();
  return `${day}${suffix} ${month}, ${year}`;
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
  onCancel,
  isCancelling = false,
}: SpotRequestCardProps) {
  const router = useRouter();
  const canCancel = status === "accepted" && Boolean(onCancel);

  function handleViewVenue() {
    if (venueId) {
      router.push(`/venues/${venueId}`);
    }
  }

  return (
    <div
      className="content-glass flex flex-col items-center gap-3 rounded-2xl p-5 text-center"
      style={{ backdropFilter: "blur(40px) saturate(120%)", WebkitBackdropFilter: "blur(40px) saturate(120%)" }}
    >
      <p
        className="font-[family-name:var(--font-bebas)] uppercase text-white"
        style={{ fontSize: "clamp(1.7rem, 9vw, 2.3rem)", letterSpacing: "2px", textShadow: headerTextShadow }}
      >
        {venueName}
      </p>

      <div className="flex w-full flex-col items-center gap-2">
        <p
          className="font-[family-name:var(--font-bebas)] uppercase text-white"
          style={{ fontSize: "clamp(1.4rem, 7.5vw, 1.75rem)", letterSpacing: "1px", textShadow: bodyTextShadow }}
        >
          {formatOrdinalDate(date)}
        </p>
        <p
          className="font-[family-name:var(--font-bebas)] uppercase text-white"
          style={{ fontSize: "clamp(1.2rem, 6.5vw, 1.5rem)", letterSpacing: "1.5px", textShadow: bodyTextShadow }}
        >
          {formatTime12h(startTime)}
        </p>
        <p
          className="font-[family-name:var(--font-bebas)] uppercase text-white"
          style={{ fontSize: "clamp(1.2rem, 6.5vw, 1.5rem)", letterSpacing: "1.5px", textShadow: bodyTextShadow }}
        >
          {spotType === "busking" ? "Busking" : "Non-Busking"}
        </p>
      </div>

      {venueMessage ? <p className="text-xs font-medium text-zinc-300">Note: {venueMessage}</p> : null}

      <p
        className="font-[family-name:var(--font-bebas)] uppercase"
        style={{
          fontSize: "clamp(1rem, 5.5vw, 1.2rem)",
          letterSpacing: "2.5px",
          textShadow: statusTextShadow,
          color: STATUS_COLOR[status] ?? "#ffffff",
        }}
      >
        {STATUS_LABEL[status] ?? status}
      </p>

      <div className="mt-1 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={handleViewVenue}
          disabled={!venueId}
          className="w-full rounded-xl bg-[#38bdf8] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0ea5e9] disabled:opacity-50"
        >
          View Venue
        </button>

        {canCancel ? (
          <button
            type="button"
            disabled={isCancelling}
            onClick={onCancel}
            className="w-full rounded-xl border border-red-800 bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
          >
            {isCancelling ? "Cancelling…" : "Cancel Spot"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
