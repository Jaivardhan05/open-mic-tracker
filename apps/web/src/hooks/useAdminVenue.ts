"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminVenueDetail } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

// One venue for Page B. `notFound` is separate from `error` so a bad or
// deleted id reads as "no such venue", not as a failure to retry.
export function useAdminVenue(venueId: string) {
  const [venue, setVenue] = useState<AdminVenueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await authorizedFetch(`/api/admin/manage/venues/${encodeURIComponent(venueId)}`);
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return;
      if (res.status === 404) {
        setNotFound(true);
        setError("");
        return;
      }
      if (!res.ok || !data) {
        setError((data && data.error) || "Couldn't load this venue.");
        return;
      }
      setNotFound(false);
      setError("");
      setVenue(data as AdminVenueDetail);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load this venue.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { venue, isLoading, notFound, error, refetch };
}
