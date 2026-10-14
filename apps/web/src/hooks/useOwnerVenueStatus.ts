"use client";

import { useCallback, useEffect, useState } from "react";

import type { OwnerVenueStatus } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export interface VenueDetailsInput {
  name: string;
  city: string;
  description: string;
}

type ActionResult = { success: boolean; error?: string };

// The signed-in venue owner's own venue state (review status, admin note,
// what they may do next). `status` stays null until loaded, and on error, so
// callers must not assume anything about permissions from null: the server
// enforces every rule regardless.
export function useOwnerVenueStatus() {
  const [status, setStatus] = useState<OwnerVenueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await authorizedFetch("/api/venues/mine/status");
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setStatus(data as OwnerVenueStatus);
      }
    } catch {
      // Leave the previous state; the dashboard works without the panel.
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

  const saveDetails = useCallback(async (input: VenueDetailsInput): Promise<ActionResult> => {
    try {
      const res = await authorizedFetch("/api/venues/mine", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error ?? "Couldn't save your changes." };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Couldn't save your changes." };
    }
  }, []);

  const resubmit = useCallback(async (): Promise<ActionResult> => {
    try {
      const res = await authorizedFetch("/api/venues/mine/resubmit", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error ?? "Couldn't resubmit your venue." };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Couldn't resubmit your venue." };
    }
  }, []);

  return { status, isLoading, refetch, saveDetails, resubmit };
}
