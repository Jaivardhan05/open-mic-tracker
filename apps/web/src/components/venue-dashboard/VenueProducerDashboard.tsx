"use client";

import { useState } from "react";

import BrandMark from "@/components/BrandMark";
import CtaButton from "@/components/CtaButton";
import { useVenueSpots } from "@/hooks/useVenueSpots";
import type { AuthUser } from "@/lib/auth";

import AddSpotForm from "./AddSpotForm";
import CancelSpotDialog from "./CancelSpotDialog";
import EditSpotForm from "./EditSpotForm";
import RequestsPanel from "./RequestsPanel";
import VenueSpotsListSection from "./VenueSpotsListSection";
import VenueNoticesSection from "./VenueNoticesSection";

interface VenueProducerDashboardProps {
  user: AuthUser;
}

export default function VenueProducerDashboard({ user }: VenueProducerDashboardProps) {
  const { spots, isLoading, createSpot, editSpot, cancelSpot } = useVenueSpots();
  const [showAddForm, setShowAddForm] = useState(false);
  const [requestsSpotId, setRequestsSpotId] = useState<string | null>(null);
  const [editSpotId, setEditSpotId] = useState<string | null>(null);
  const [cancelSpotId, setCancelSpotId] = useState<string | null>(null);

  const requestsSpot = spots.find((s) => s.id === requestsSpotId) ?? null;
  const editSpotTarget = spots.find((s) => s.id === editSpotId) ?? null;

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

      <section className="mt-6 px-4 md:px-6 text-center md:text-left">
        <CtaButton type="button" onClick={() => setShowAddForm(true)}>
          + Add a new Spot
        </CtaButton>
      </section>

      <VenueNoticesSection />

      <VenueSpotsListSection
        spots={spots}
        isLoading={isLoading}
        onViewRequests={(spotId) => setRequestsSpotId(spotId)}
        onEditSpot={(spotId) => setEditSpotId(spotId)}
        onCancelSpot={(spotId) => setCancelSpotId(spotId)}
      />

      {showAddForm ? (
        <AddSpotForm onSubmit={createSpot} onClose={() => setShowAddForm(false)} />
      ) : null}

      {editSpotTarget ? (
        <EditSpotForm spot={editSpotTarget} onSubmit={editSpot} onClose={() => setEditSpotId(null)} />
      ) : null}

      {requestsSpot ? (
        <RequestsPanel
          spotId={requestsSpot.id}
          spotAvailableSpots={requestsSpot.available_spots}
          spotDate={requestsSpot.date}
          spotStartTime={requestsSpot.start_time}
          spotEndTime={requestsSpot.end_time}
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
