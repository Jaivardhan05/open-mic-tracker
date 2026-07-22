"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdminVenue } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export function useAdminVenues() {
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/venues");
    const data = await res.json();
    if (res.ok) {
      setVenues(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/admin/venues");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setVenues(Array.isArray(data) ? data : []);
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

  const hideVenue = useCallback(
    async (venueId: string, reason: string) => {
      const res = await authorizedFetch(`/api/venues/${venueId}/hide`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to hide venue" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const unhideVenue = useCallback(
    async (venueId: string) => {
      const res = await authorizedFetch(`/api/venues/${venueId}/unhide`, {
        method: "POST",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to unhide venue" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  return { venues, isLoading, hideVenue, unhideVenue };
}
