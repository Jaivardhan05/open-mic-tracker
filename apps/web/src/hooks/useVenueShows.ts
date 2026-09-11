"use client";

import { useCallback, useEffect, useState } from "react";

import type { VenueShow } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

// Renamed from useVenueSpots — a Show has up to three spot pools
// (busking / non_busking / hosting). See specs/venue-dashboard.md §9.

export interface PoolInput {
  spots: number;
  price: number | null;
}

export interface NewShowInput {
  date: string;
  start_time: string;
  end_time: string;
  busking: PoolInput;
  non_busking: PoolInput;
  hosting: { enabled: boolean; price: number | null };
}

export interface EditShowInput {
  date: string;
  busking: PoolInput;
  non_busking: PoolInput;
  hosting: { enabled: boolean; price: number | null };
}

function toRequestBody(input: NewShowInput | EditShowInput) {
  return {
    ...("start_time" in input ? { start_time: input.start_time, end_time: input.end_time } : {}),
    date: input.date,
    busking_spots: input.busking.spots,
    busking_price: input.busking.price,
    non_busking_spots: input.non_busking.spots,
    non_busking_price: input.non_busking.price,
    hosting: input.hosting.enabled,
    hosting_price: input.hosting.price,
  };
}

export function useVenueShows() {
  const [shows, setShows] = useState<VenueShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await authorizedFetch("/api/venue-shows/mine");
    const data = await res.json();
    if (res.ok) {
      setShows(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/venue-shows/mine");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setShows(Array.isArray(data) ? data : []);
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

  const createShow = useCallback(
    async (input: NewShowInput) => {
      const res = await authorizedFetch("/api/venue-shows", {
        method: "POST",
        body: JSON.stringify(toRequestBody(input)),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to create show" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const editShow = useCallback(
    async (showId: string, input: EditShowInput) => {
      const res = await authorizedFetch(`/api/venue-shows/${showId}/edit`, {
        method: "POST",
        body: JSON.stringify(toRequestBody(input)),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to update show" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const cancelShow = useCallback(
    async (showId: string, message?: string) => {
      const res = await authorizedFetch(`/api/venue-shows/${showId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to cancel show" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  return { shows, isLoading, refetch, createShow, editShow, cancelShow };
}
