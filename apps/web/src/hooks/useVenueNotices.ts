"use client";

import { useEffect, useState } from "react";

import type { VenueNotice } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export function useVenueNotices() {
  const [notices, setNotices] = useState<VenueNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/venue-producer/notices");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setNotices(Array.isArray(data) ? data : []);
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

  return { notices, isLoading };
}
