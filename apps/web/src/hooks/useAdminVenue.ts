"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminVenueDetail } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export interface SuspensionPreview {
  shows: number;
  spots: number;
  requests: { pending: number; accepted: number; waitlisted: number; total: number };
  comedians: number;
}

// What a suspend actually cancelled (the real numbers, not the preview's).
export interface SuspendCounts {
  shows: number;
  spots: number;
  requests: number;
  comedians: number;
}

// The fields an admin may edit; send only the ones that changed. Cleared
// optional fields go as "" (the API stores null).
export interface AdminVenueChanges {
  name?: string;
  city?: string;
  description?: string;
  photos?: string[];
  instagram_url?: string;
  x_url?: string;
  maps_url?: string;
  contact_email?: string;
  contact_phone?: string;
}

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

  // What suspending would cancel right now (a snapshot; see suspendVenue).
  const getSuspensionPreview = useCallback(
    async (): Promise<{ success: true; preview: SuspensionPreview } | { success: false; error: string }> => {
      try {
        const res = await authorizedFetch(
          `/api/admin/manage/venues/${encodeURIComponent(venueId)}/suspension-preview`
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          return { success: false, error: (data && data.error) || "Couldn't load what suspending would cancel." };
        }
        return { success: true, preview: data as SuspensionPreview };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Couldn't load what suspending would cancel.",
        };
      }
    },
    [venueId]
  );

  // Never throws. The counts in the response are the real ones and can differ
  // from the preview if something changed in between.
  const suspendVenue = useCallback(
    async (reason: string): Promise<{ success: true; counts: SuspendCounts } | { success: false; error: string }> => {
      try {
        const res = await authorizedFetch(`/api/admin/manage/venues/${encodeURIComponent(venueId)}/suspend`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          return { success: false, error: (data && data.error) || "Action failed. Try again." };
        }
        return {
          success: true,
          counts: {
            shows: Number(data.shows) || 0,
            spots: Number(data.spots) || 0,
            requests: Number(data.requests) || 0,
            comedians: Number(data.comedians) || 0,
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Action failed. Try again." };
      }
    },
    [venueId]
  );

  // Saves edits (PATCH) and, on success, shows the venue the API returns.
  const updateVenue = useCallback(
    async (changes: AdminVenueChanges): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await authorizedFetch(`/api/admin/manage/venues/${encodeURIComponent(venueId)}`, {
          method: "PATCH",
          body: JSON.stringify(changes),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          return { success: false, error: (data && data.error) || "Couldn't save. Try again." };
        }
        setVenue(data as AdminVenueDetail);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Couldn't save. Try again." };
      }
    },
    [venueId]
  );

  return { venue, isLoading, notFound, error, refetch, getSuspensionPreview, suspendVenue, updateVenue };
}
