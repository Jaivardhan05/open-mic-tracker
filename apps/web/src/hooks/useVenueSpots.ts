"use client";

import { useCallback, useEffect, useState } from "react";

import type { Spot } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export interface NewSpotInput {
  date: string;
  start_time: string;
  end_time: string;
  spot_type: "busking" | "non_busking";
  total_spots: number;
  price: number | null;
}

export function useVenueSpots() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await authorizedFetch("/api/spots/mine");
    const data = await res.json();
    if (res.ok) {
      setSpots(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/spots/mine");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSpots(Array.isArray(data) ? data : []);
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

  const createSpot = useCallback(
    async (input: NewSpotInput) => {
      const res = await authorizedFetch("/api/spots", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: result.error ?? "Failed to create spot" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const cancelSpot = useCallback(
    async (spotId: string, message?: string) => {
      const res = await authorizedFetch(`/api/spots/${spotId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to cancel spot" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  return { spots, isLoading, refetch, createSpot, cancelSpot };
}
