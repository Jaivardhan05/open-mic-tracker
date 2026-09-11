"use client";

import { useState } from "react";

import type { Spot } from "@repo/types";

import BrandMark from "@/components/BrandMark";
import CtaButton from "@/components/CtaButton";
import { useVenueShows } from "@/hooks/useVenueShows";
import type { AuthUser } from "@/lib/auth";

import AddShowForm from "./AddShowForm";
import CancelShowDialog from "./CancelShowDialog";
import EditShowForm from "./EditShowForm";
import RequestsPanel from "./RequestsPanel";
import VenueShowsListSection from "./VenueShowsListSection";
import VenueNoticesSection from "./VenueNoticesSection";

interface VenueProducerDashboardProps {
  user: AuthUser;
}

export default function VenueProducerDashboard({ user }: VenueProducerDashboardProps) {
  const { shows, isLoading, createShow, editShow, cancelShow } = useVenueShows();
  const [showAddForm, setShowAddForm] = useState(false);
  const [requestsSpotId, setRequestsSpotId] = useState<string | null>(null);
  const [editShowId, setEditShowId] = useState<string | null>(null);
  const [cancelShowId, setCancelShowId] = useState<string | null>(null);

  // "View Requests" is per pool (a spots.id), while Edit/Cancel act on the
  // whole show — so the requests panel is looked up across every show's
  // three pools rather than by show id. See specs/venue-dashboard.md §9.4.
  const requestsSpot: Spot | null =
    shows
      .flatMap((s) => [s.busking, s.non_busking, s.hosting])
      .find((pool): pool is Spot => pool?.id === requestsSpotId) ?? null;
  const editShowTarget = shows.find((s) => s.id === editShowId) ?? null;

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
          + Add new shows
        </CtaButton>
      </section>

      <VenueNoticesSection />

      <VenueShowsListSection
        shows={shows}
        isLoading={isLoading}
        onViewRequests={(spotId) => setRequestsSpotId(spotId)}
        onEditShow={(showId) => setEditShowId(showId)}
        onCancelShow={(showId) => setCancelShowId(showId)}
      />

      {showAddForm ? (
        <AddShowForm onSubmit={createShow} onClose={() => setShowAddForm(false)} />
      ) : null}

      {editShowTarget ? (
        <EditShowForm show={editShowTarget} onSubmit={editShow} onClose={() => setEditShowId(null)} />
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

      {cancelShowId ? (
        <CancelShowDialog
          onConfirm={(message) => cancelShow(cancelShowId, message)}
          onClose={() => setCancelShowId(null)}
        />
      ) : null}
    </>
  );
}
