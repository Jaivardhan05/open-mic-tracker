"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdminManagedVenue } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export function useAdminVenueList() {
  const [venues, setVenues] = useState<AdminManagedVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/manage/venues");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Couldn't load venues.");
        return;
      }
      setVenues(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load venues.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await refetch();
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  // Runs one review outcome. The caller refetches (after its exit animation).
  const reviewVenue = useCallback(
    async (
      venueId: string,
      kind: "approve" | "reject" | "request_changes",
      reason?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const path = kind === "request_changes" ? "request-changes" : kind;
      try {
        const res = await authorizedFetch(`/api/admin/manage/venues/${venueId}/${path}`, {
          method: "POST",
          body: JSON.stringify(reason === undefined ? {} : { reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { success: false, error: data.error ?? "Action failed. Try again." };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Action failed. Try again." };
      }
    },
    []
  );

  return { venues, isLoading, error, refetch, reviewVenue };
}
