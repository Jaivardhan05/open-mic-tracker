"use client";

import SpotRequestCard from "@/components/dashboard/SpotRequestCard";

export default function DebugSpotCardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SpotRequestCard
          venueName="The Comedy Cellar Basement Room"
          venueId="v1"
          date="2026-08-14"
          startTime="20:30"
          spotType="busking"
          status="pending"
          onCancel={() => {}}
        />
        <SpotRequestCard
          venueName="Blue Moon"
          venueId="v2"
          date="2026-08-20"
          startTime="19:00"
          spotType="non_busking"
          status="accepted"
          venueMessage="Please arrive 30 minutes early for sound check."
          onCancel={() => {}}
        />
        <SpotRequestCard
          venueName="Laugh Factory"
          venueId="v3"
          date="2026-08-09"
          startTime="21:15"
          spotType="busking"
          status="waitlisted"
        />
        <SpotRequestCard
          venueName="The Underground"
          venueId="v4"
          date="2026-08-05"
          startTime="18:00"
          spotType="non_busking"
          status="cancelled_by_venue"
          venueMessage="Spot canceled by venue"
        />
      </div>
    </div>
  );
}
