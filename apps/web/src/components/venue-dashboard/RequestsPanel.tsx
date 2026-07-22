"use client";

import { useState } from "react";

import { useSpotRequests, type SpotRequestRow } from "@/hooks/useSpotRequests";

interface RequestsPanelProps {
  spotId: string;
  spotAvailableSpots: number;
  onClose: () => void;
}

function RequestCard({
  request,
  actionLabel,
  onAction,
  disabled,
  showMessageInput,
}: {
  request: SpotRequestRow;
  actionLabel?: string;
  onAction?: (message: string) => void;
  disabled?: boolean;
  showMessageInput?: boolean;
}) {
  const [message, setMessage] = useState("");

  return (
    <div className="content-glass rounded-xl p-3">
      <p className="text-sm font-semibold text-white">{request.comedian_name ?? "Comedian"}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Requested {new Date(request.requested_at).toLocaleString()}
      </p>
      {request.venue_message ? (
        <p className="mt-1 text-xs text-zinc-400">Note: {request.venue_message}</p>
      ) : null}
      {onAction ? (
        <div className="mt-2 flex flex-col gap-2">
          {showMessageInput ? (
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-[#38bdf8]/60"
            />
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction(message)}
            className="w-full rounded-lg bg-[#38bdf8] px-2 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#0ea5e9] disabled:opacity-50"
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function RequestsPanel({ spotId, spotAvailableSpots, onClose }: RequestsPanelProps) {
  const { requests, isLoading, acceptRequest } = useSpotRequests(spotId);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="content-glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Requests</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 transition-colors hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        {isLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                Pending ({requests.pending.length})
              </h3>
              {requests.pending.length === 0 ? (
                <p className="text-xs text-zinc-500">No pending requests.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.pending.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
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
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                Accepted ({requests.accepted.length})
              </h3>
              {requests.accepted.length === 0 ? (
                <p className="text-xs text-zinc-500">No accepted requests yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.accepted.map((r) => (
                    <RequestCard key={r.id} request={r} />
                  ))}
                </div>
              )}
            </div>

            {requests.waitlisted.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                  Waitlisted ({requests.waitlisted.length})
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {requests.waitlisted.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      actionLabel={pendingActionId === r.id ? "Promoting…" : "Promote"}
                      disabled={pendingActionId === r.id || spotAvailableSpots <= 0}
                      showMessageInput
                      onAction={(message) => handleAccept(r.id, message)}
                    />
                  ))}
                </div>
                {spotAvailableSpots <= 0 ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
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
