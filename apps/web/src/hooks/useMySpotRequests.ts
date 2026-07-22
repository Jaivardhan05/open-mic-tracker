"use client";

import { useCallback, useEffect, useState } from "react";

import type { SpotRequest } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export function useMySpotRequests() {
  const [spotRequests, setSpotRequests] = useState<SpotRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await authorizedFetch("/api/spot-requests/mine");
    const data = await res.json();
    if (res.ok) {
      setSpotRequests(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/spot-requests/mine");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSpotRequests(Array.isArray(data) ? data : []);
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
  }, []);

  const applyToSpot = useCallback(
    async (spotId: string) => {
      const res = await authorizedFetch("/api/spot-requests", {
        method: "POST",
        body: JSON.stringify({ spot_id: spotId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to apply to spot" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const cancelSpotRequest = useCallback(async (requestId: string) => {
    const res = await authorizedFetch(`/api/spot-requests/${requestId}/cancel`, { method: "POST" });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return { success: false, error: result.error ?? "Failed to cancel request" };
    }
    setSpotRequests((prev) => prev.filter((r) => r.id !== requestId));
    return { success: true };
  }, []);

  return { spotRequests, isLoading, applyToSpot, cancelSpotRequest, refetch };
}
