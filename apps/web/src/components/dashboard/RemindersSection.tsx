"use client";

import { useState } from "react";

import type { Booking, SpotRequest } from "@repo/types";

interface RemindersSectionProps {
  bookings: Booking[];
  isLoading: boolean;
  onCancel: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  onDecline: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  spotRequests?: SpotRequest[];
  isSpotRequestsLoading?: boolean;
  onCancelSpotRequest?: (requestId: string) => Promise<{ success: boolean; error?: string }>;
}

const SPOT_REQUEST_STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  cancelled_by_venue: "Cancelled by venue",
};

export default function RemindersSection({
  bookings,
  isLoading,
  onCancel,
  onDecline,
  spotRequests = [],
  isSpotRequestsLoading = false,
  onCancelSpotRequest,
}: RemindersSectionProps) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visibleSpotRequests = spotRequests.filter((r) =>
    ["accepted", "waitlisted", "cancelled_by_venue"].includes(r.status)
  );

  async function handleCancelSpotRequest(requestId: string) {
    if (!onCancelSpotRequest) return;
    setPendingActionId(requestId);
    setError("");
    const result = await onCancelSpotRequest(requestId);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel request");
    }
    setPendingActionId(null);
  }

  async function handleCancel(bookingId: string) {
    setPendingActionId(bookingId);
    setError("");
    const result = await onCancel(bookingId);
    if (!result.success) {
      setError(result.error ?? "Failed to cancel booking");
    }
    setPendingActionId(null);
  }

  async function handleDecline(bookingId: string) {
    setPendingActionId(bookingId);
    setError("");
    const result = await onDecline(bookingId);
    if (!result.success) {
      setError(result.error ?? "Failed to decline booking");
    }
    setPendingActionId(null);
  }

  if (isLoading && isSpotRequestsLoading) {
    return null;
  }

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Reminders &amp; Confirmations</h2>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {bookings.length === 0 && visibleSpotRequests.length === 0 ? (
        <p className="content-glass mt-3 rounded-2xl px-4 py-3 text-sm text-zinc-400">
          No pending confirmations.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSpotRequests.map((request) => (
            <div key={request.id} className="content-glass rounded-2xl p-4">
              <p className="text-sm font-semibold text-white">{request.venue_name ?? "Venue"}</p>
              {request.spot ? (
                <p className="mt-1 text-xs text-zinc-400">
                  {request.spot.date} · {request.spot.start_time}–{request.spot.end_time}
                </p>
              ) : null}
              <div className="mt-3">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    request.status === "accepted"
                      ? "border-[#38bdf8]/60 text-[#38bdf8]"
                      : request.status === "cancelled_by_venue"
                        ? "border-red-800 text-red-400"
                        : "border-zinc-600 text-zinc-400"
                  }`}
                >
                  {SPOT_REQUEST_STATUS_LABEL[request.status] ?? request.status}
                </span>
              </div>
              {request.venue_message ? (
                <p className="mt-2 text-xs text-zinc-400">Note: {request.venue_message}</p>
              ) : null}
              {request.status === "accepted" && onCancelSpotRequest ? (
                <button
                  type="button"
                  disabled={pendingActionId === request.id}
                  onClick={() => handleCancelSpotRequest(request.id)}
                  className="mt-3 w-full rounded-xl border border-red-800 bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
                >
                  {pendingActionId === request.id ? "Cancelling…" : "Cancel"}
                </button>
              ) : null}
            </div>
          ))}

          {bookings.map((booking) => {
            const isAwaitingVenue = booking.booking_status === "awaiting_confirmation";
            return (
              <div key={booking.id} className="content-glass rounded-2xl p-4">
                <p className="text-sm font-semibold text-white">{booking.venue?.name ?? "Venue"}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {booking.show?.date} · {booking.show?.start_time}–{booking.show?.end_time}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {booking.show?.charge ? `₹${booking.show.charge}` : "Free"} · {booking.slots_booked} spot
                  {booking.slots_booked > 1 ? "s" : ""}
                </p>

                {isAwaitingVenue ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-zinc-600 px-3 py-1 text-[11px] font-semibold text-zinc-400">
                      Waiting for confirmation
                    </span>
                    <button
                      type="button"
                      disabled={pendingActionId === booking.id}
                      onClick={() => handleCancel(booking.id)}
                      className="rounded-xl border border-red-800 bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
                    >
                      {pendingActionId === booking.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                ) : payingId === booking.id ? (
                  <p className="mt-3 rounded-lg bg-[#38bdf8]/10 px-3 py-2 text-xs text-[#38bdf8]">
                    Payment coming soon.
                  </p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPayingId(booking.id)}
                      className="flex-1 rounded-xl bg-[#38bdf8] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0ea5e9]"
                    >
                      Accept &amp; Pay
                    </button>
                    <button
                      type="button"
                      disabled={pendingActionId === booking.id}
                      onClick={() => handleDecline(booking.id)}
                      className="flex-1 rounded-xl border border-red-800 bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
                    >
                      {pendingActionId === booking.id ? "Declining…" : "Decline"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
