"use client";

import { useCallback, useEffect, useState } from "react";

import type { SpotRequest } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

interface UseMySpotRequestsOptions {
  /**
   * Refetch when the tab becomes visible or the window regains focus, so changes
   * the venue owner makes (accept, swap, cancel) show up without a reload.
   */
  refreshOnFocus?: boolean;
}

// Visibility and focus usually fire together on a tab switch.
const FOCUS_REFETCH_MIN_INTERVAL_MS = 2000;

export function useMySpotRequests({ refreshOnFocus = false }: UseMySpotRequestsOptions = {}) {
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
    if (!refreshOnFocus) return;

    let lastRefetchAt = 0;
    function handleReturn() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRefetchAt < FOCUS_REFETCH_MIN_INTERVAL_MS) return;
      lastRefetchAt = now;
      refetch().catch(() => {
        // Keep showing the last known state if the refresh fails.
      });
    }

    document.addEventListener("visibilitychange", handleReturn);
    window.addEventListener("focus", handleReturn);
    return () => {
      document.removeEventListener("visibilitychange", handleReturn);
      window.removeEventListener("focus", handleReturn);
    };
  }, [refreshOnFocus, refetch]);

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
