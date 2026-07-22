"use client";

import { useCallback, useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/apiClient";

export interface SpotRequestRow {
  id: string;
  spot_id: string;
  comedian_id: string;
  comedian_name?: string;
  status: string;
  venue_message: string | null;
  requested_at: string;
  decided_at: string | null;
}

export interface GroupedSpotRequests {
  pending: SpotRequestRow[];
  accepted: SpotRequestRow[];
  waitlisted: SpotRequestRow[];
  cancelled_by_comedian: SpotRequestRow[];
  cancelled_by_venue: SpotRequestRow[];
}

const EMPTY_GROUPS: GroupedSpotRequests = {
  pending: [],
  accepted: [],
  waitlisted: [],
  cancelled_by_comedian: [],
  cancelled_by_venue: [],
};

export function useSpotRequests(spotId: string | null) {
  const [requests, setRequests] = useState<GroupedSpotRequests>(EMPTY_GROUPS);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!spotId) {
      setRequests(EMPTY_GROUPS);
      return;
    }
    const res = await authorizedFetch(`/api/spots/${spotId}/requests`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.requests) {
      setRequests(data.requests);
    }
  }, [spotId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!spotId) {
        setRequests(EMPTY_GROUPS);
        return;
      }
      setIsLoading(true);
      try {
        const res = await authorizedFetch(`/api/spots/${spotId}/requests`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.requests) {
          setRequests(data.requests);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [spotId]);

  const acceptRequest = useCallback(
    async (requestId: string, message?: string) => {
      const res = await authorizedFetch(`/api/spot-requests/${requestId}/accept`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to accept request" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  return { requests, isLoading, refetch, acceptRequest };
}
