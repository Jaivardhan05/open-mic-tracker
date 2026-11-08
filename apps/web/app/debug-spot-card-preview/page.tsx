"use client";

import SpotRequestCard from "@/components/dashboard/SpotRequestCard";

// Fixed instants far in the future / past so the "open" and "closed" states
// look the same whenever this page is opened.
const CANCEL_BY_OPEN = "2099-01-01T14:00:00.000Z";
const CANCEL_BY_CLOSED = "2020-01-01T14:00:00.000Z";

export default function DebugSpotCardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Payments Step 1c states: pending with a cutoff, accepted with the
            locked price and cancel-by (open / closed / free). */}
        <SpotRequestCard
          venueName="Pending, venue allows 6 h"
          venueId="p1"
          date="2026-08-14"
          startTime="20:30"
          spotType="hosting"
          status="pending"
          venueCancelCutoffHours={6}
          onCancel={() => {}}
        />
        <SpotRequestCard
          venueName="Accepted, cancel open"
          venueId="p2"
          date="2099-01-02"
          startTime="19:30"
          spotType="busking"
          status="accepted"
          lockedPricePaise={15000}
          cancelBy={CANCEL_BY_OPEN}
          onCancel={() => {}}
        />
        <SpotRequestCard
          venueName="Accepted, cancel closed"
          venueId="p3"
          date="2020-01-02"
          startTime="19:30"
          spotType="non_busking"
          status="accepted"
          lockedPricePaise={20000}
          cancelBy={CANCEL_BY_CLOSED}
          onCancel={() => {}}
        />
        <SpotRequestCard
          venueName="Accepted, free hosting"
          venueId="p4"
          date="2099-01-02"
          startTime="19:30"
          spotType="hosting"
          status="accepted"
          lockedPricePaise={0}
          cancelBy={CANCEL_BY_OPEN}
          onCancel={() => {}}
        />
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
