"use client";

import { useCallback, useEffect, useState } from "react";

import type { Booking } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

export function useComedianBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await authorizedFetch("/api/me/bookings/pending");
    const data = await res.json();
    if (res.ok) {
      setBookings(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/me/bookings/pending");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setBookings(Array.isArray(data) ? data : []);
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

  const bookSpot = useCallback(
    async (showId: string) => {
      const res = await authorizedFetch(`/api/shows/${showId}/book`, { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return { success: false, error: result.error ?? "Failed to book spot" };
      }
      await refetch();
      return { success: true };
    },
    [refetch]
  );

  const cancelBooking = useCallback(async (bookingId: string) => {
    const res = await authorizedFetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return { success: false, error: result.error ?? "Failed to cancel booking" };
    }
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    return { success: true };
  }, []);

  const declineBooking = useCallback(async (bookingId: string) => {
    const res = await authorizedFetch(`/api/bookings/${bookingId}/decline`, { method: "POST" });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return { success: false, error: result.error ?? "Failed to decline booking" };
    }
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    return { success: true };
  }, []);

  return { bookings, isLoading, bookSpot, cancelBooking, declineBooking };
}
