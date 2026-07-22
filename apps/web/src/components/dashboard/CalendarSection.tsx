"use client";

import { useEffect, useState } from "react";

import type { Booking } from "@repo/types";

import { authorizedFetch } from "@/lib/apiClient";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNext7Days() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return date;
  });
}

export default function CalendarSection() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await authorizedFetch("/api/me/bookings/upcoming?days=7");
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

  if (isLoading) {
    return null;
  }

  const days = getNext7Days();
  const bookingsByDay = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (!booking.show) continue;
    const key = booking.show.date;
    const existing = bookingsByDay.get(key);
    if (existing) {
      existing.push(booking);
    } else {
      bookingsByDay.set(key, [booking]);
    }
  }

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Next 7 Days</h2>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {days.map((date) => {
          const key = toDateKey(date);
          const dayBookings = bookingsByDay.get(key) ?? [];
          const isToday = key === toDateKey(new Date());
          return (
            <div
              key={key}
              className={`content-glass flex min-h-[7rem] flex-col rounded-xl p-2 ${
                isToday ? "border border-[#38bdf8]/40" : "border border-white/10"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase text-zinc-400">
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className="text-xs font-bold text-white">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
              <div className="mt-2 flex flex-1 flex-col gap-1">
                {dayBookings.map((booking) => {
                  const isConfirmedPaid = booking.booking_status === "confirmed_paid";
                  return (
                    <div
                      key={booking.id}
                      title={booking.venue?.name}
                      className={`truncate rounded-lg px-2 py-1 text-[10px] font-semibold ${
                        isConfirmedPaid
                          ? "border border-[#38bdf8]/60 bg-[#38bdf8]/20 text-[#38bdf8]"
                          : "border border-zinc-600/60 bg-white/5 text-zinc-400"
                      }`}
                    >
                      {booking.venue?.name ?? "Venue"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
