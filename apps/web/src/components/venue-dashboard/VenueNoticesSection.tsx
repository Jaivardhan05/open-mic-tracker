"use client";

import { useVenueNotices } from "@/hooks/useVenueNotices";

export default function VenueNoticesSection() {
  const { notices, isLoading } = useVenueNotices();

  if (isLoading || notices.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 px-4 md:px-6">
      <h2 className="text-lg font-bold text-white">Notices from Admin</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {notices.map((notice) => (
          <div key={notice.id} className="content-glass rounded-2xl p-4">
            <p className="text-sm font-semibold text-white">{notice.venue_name}</p>
            <p className="mt-2 text-xs text-zinc-400">{notice.reason}</p>
            <p className="mt-2 text-[11px] text-zinc-600">
              {new Date(notice.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
