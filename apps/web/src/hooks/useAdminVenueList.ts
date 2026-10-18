"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminManagedVenue, AdminVenueListResponse, VenueDisplayStatus } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";
import { runVenueAction } from "@/lib/adminVenueActions";

export interface AdminVenueFilters {
  q: string;
  status: "all" | VenueDisplayStatus;
  city: string;
}

const EMPTY_COUNTS: AdminVenueListResponse["counts"] = {
  all: 0,
  pending: 0,
  changes_requested: 0,
  approved: 0,
  hidden: 0,
  suspended: 0,
  rejected: 0,
};

function buildPath(filters: AdminVenueFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== "") params.set("q", filters.q.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.city !== "") params.set("city", filters.city);
  const qs = params.toString();
  return `/api/admin/manage/venues${qs ? `?${qs}` : ""}`;
}

// Filtering is server-side. The previous list stays on screen while a new
// request runs (isFetching), and a response that arrives after a newer request
// was sent is dropped so a slow early request can't overwrite a later one.
export function useAdminVenueList(filters: AdminVenueFilters) {
  const [venues, setVenues] = useState<AdminManagedVenue[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const filtersRef = useRef(filters);
  const requestId = useRef(0);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const load = useCallback(async (next: AdminVenueFilters) => {
    const id = ++requestId.current;
    setIsFetching(true);
    try {
      const res = await authorizedFetch(buildPath(next));
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return;
      if (!res.ok || !data || !Array.isArray(data.venues)) {
        setError((data && data.error) || "Couldn't load venues.");
        return;
      }
      const body = data as AdminVenueListResponse;
      setError("");
      setVenues(body.venues);
      setCounts(body.counts);
      setCities(body.cities);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load venues.");
    } finally {
      if (id === requestId.current) {
        setIsFetching(false);
        setIsLoading(false);
      }
    }
  }, []);

  // Refetch with whatever filters are active right now (used after an action).
  const refetch = useCallback(() => load(filtersRef.current), [load]);

  const { q, status, city } = filters;
  useEffect(() => {
    void load({ q, status, city });
  }, [load, q, status, city]);

  // Runs one review outcome. The caller refetches (after its exit animation).
  const reviewVenue = useCallback(
    (venueId: string, kind: "approve" | "reject" | "request_changes", reason?: string) =>
      runVenueAction(venueId, kind, reason),
    []
  );

  return { venues, counts, cities, isLoading, isFetching, error, refetch, reviewVenue };
}
