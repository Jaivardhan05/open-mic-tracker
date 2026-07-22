"use client";

import { useState } from "react";

import BrandMark from "@/components/BrandMark";
import { useVenueSpots } from "@/hooks/useVenueSpots";
import type { AuthUser } from "@/lib/auth";

import AddSpotForm from "./AddSpotForm";
import CancelSpotDialog from "./CancelSpotDialog";
import RequestsPanel from "./RequestsPanel";
import VenueCalendarSection from "./VenueCalendarSection";
import VenueNoticesSection from "./VenueNoticesSection";

interface VenueProducerDashboardProps {
  user: AuthUser;
}

export default function VenueProducerDashboard({ user }: VenueProducerDashboardProps) {
  const { spots, isLoading, createSpot, cancelSpot } = useVenueSpots();
  const [showAddForm, setShowAddForm] = useState(false);
  const [requestsSpotId, setRequestsSpotId] = useState<string | null>(null);
  const [cancelSpotId, setCancelSpotId] = useState<string | null>(null);

  const requestsSpot = spots.find((s) => s.id === requestsSpotId) ?? null;

  return (
    <>
      <section className="px-4 pt-12 text-center">
        <h1>
          <BrandMark variant="hero" />
        </h1>
        <p className="mt-3 text-base md:text-lg text-zinc-400">
          Welcome back, <span className="font-bold text-white">{user.venueName ?? user.name}</span>
        </p>
      </section>

      <section className="mt-6 px-4 md:px-6">
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-xl bg-[#38bdf8] py-3 font-bold text-white transition-colors hover:bg-[#0ea5e9] md:w-auto md:px-6"
        >
          + Add a new Spot
        </button>
      </section>

      <VenueNoticesSection />

      <VenueCalendarSection
        spots={spots}
        isLoading={isLoading}
        onViewRequests={(spotId) => setRequestsSpotId(spotId)}
        onCancelSpot={(spotId) => setCancelSpotId(spotId)}
      />

      {showAddForm ? (
        <AddSpotForm onSubmit={createSpot} onClose={() => setShowAddForm(false)} />
      ) : null}

      {requestsSpot ? (
        <RequestsPanel
          spotId={requestsSpot.id}
          spotAvailableSpots={requestsSpot.available_spots}
          onClose={() => setRequestsSpotId(null)}
        />
      ) : null}

      {cancelSpotId ? (
        <CancelSpotDialog
          onConfirm={(message) => cancelSpot(cancelSpotId, message)}
          onClose={() => setCancelSpotId(null)}
        />
      ) : null}
    </>
  );
}
