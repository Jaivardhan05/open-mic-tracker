"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminVenueStats } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

// All-time stats for Page B's Pulse panel. Separate from useAdminVenue so a
// stats failure (or a not-yet-applied migration) never blanks the dossier.
export function useAdminVenueStats(venueId: string) {
  const [stats, setStats] = useState<AdminVenueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await authorizedFetch(`/api/admin/manage/venues/${encodeURIComponent(venueId)}/stats`);
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return;
      if (!res.ok || !data) {
        setError((data && data.error) || "Couldn't load activity.");
        return;
      }
      setError("");
      setStats(data as AdminVenueStats);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load activity.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { stats, isLoading, error, refetch };
}
