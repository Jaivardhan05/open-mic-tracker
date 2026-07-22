"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import type { Show, Spot, Venue } from '@repo/types';

import Navbar from '../../../src/components/Navbar';
import Sidebar from '../../../src/components/Sidebar';
import { useAuth } from '../../../src/context/AuthContext';
import { SpotlightCard } from '../../../src/components/venues/SpotlightCard';
import { useComedianBookings } from '../../../src/hooks/useComedianBookings';
import { useMySpotRequests } from '../../../src/hooks/useMySpotRequests';

const SPOT_REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: 'Requested',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  cancelled_by_venue: 'Cancelled by venue',
};

export default function VenueDetailPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');
  const { bookings, bookSpot } = useComedianBookings();
  const { spotRequests, applyToSpot } = useMySpotRequests();
  const [bookingShowId, setBookingShowId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [applyingSpotId, setApplyingSpotId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!id) return;

    async function fetchVenue() {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/venues/${id}`);
        if (!res.ok) {
          setError('Venue not found.');
          return;
        }
        const data: { venue: Venue; shows: Show[]; spots?: Spot[] } = await res.json();
        setVenue(data.venue);
        setShows(data.shows ?? []);
        setSpots(data.spots ?? []);
      } catch {
        setError('Failed to load venue.');
      } finally {
        setIsFetching(false);
      }
    }

    void fetchVenue();
  }, [id]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  async function handleBook(showId: string) {
    setBookingShowId(showId);
    setBookingError('');
    const result = await bookSpot(showId);
    if (!result.success) {
      setBookingError(result.error ?? 'Failed to book spot');
    }
    setBookingShowId(null);
  }

  async function handleApply(spotId: string) {
    setApplyingSpotId(spotId);
    setApplyError('');
    const result = await applyToSpot(spotId);
    if (!result.success) {
      setApplyError(result.error ?? 'Failed to apply to spot');
    }
    setApplyingSpotId(null);
  }

  return (
    <div className="layout-root">
      <Navbar />
      <div className="flex">
        <Sidebar onFilter={() => {}} />

        <main
          className="main-content-glass sidebar-content-margin lg:ml-[var(--sidebar-w)] overflow-y-auto w-full"
          style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
        >
          <div className="px-4 md:px-8 py-8">
          <div className="mb-6">
            <Link
              href="/venues"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              All Venues
            </Link>
          </div>

          {isFetching ? (
            <div className="flex justify-center mt-20">
              <div className="animate-spin w-8 h-8 rounded-full border-2 border-zinc-700 border-t-[#38bdf8]" />
            </div>
          ) : error ? (
            <div className="text-center text-red-400 mt-20">{error}</div>
          ) : venue ? (
            <div className="max-w-3xl">
              <SpotlightCard className="rounded-2xl overflow-hidden mb-6">
                <div className="relative aspect-video w-full">
                  <Image
                    src={venue.photos?.[0] ?? `https://picsum.photos/seed/${venue.id}/800/450`}
                    alt={venue.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    unoptimized
                    className="object-cover"
                  />
                </div>

                <div className="p-6">
                  <h1 className="text-2xl font-bold text-white mb-1">{venue.name}</h1>
                  <p className="text-zinc-400 text-sm mb-1">{venue.address}</p>
                  <p className="text-zinc-500 text-xs mb-4">{venue.city}</p>

                  {venue.description ? (
                    <p className="text-zinc-300 text-sm leading-relaxed">{venue.description}</p>
                  ) : null}
                </div>
              </SpotlightCard>

              <h2 className="text-lg font-bold text-white mb-4">Upcoming Shows</h2>
              {bookingError ? <p className="mb-4 text-sm text-red-400">{bookingError}</p> : null}

              {shows.length === 0 ? (
                <p className="text-zinc-500 text-sm">No upcoming shows at this venue.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shows.map((show) => (
                    <SpotlightCard key={show.id} className="rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            show.spot_type === 'busking'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {show.spot_type === 'busking' ? 'Busking' : 'Non-Busking'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            Number(show.available_spots) <= 3 ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {show.available_spots} spots left
                        </span>
                      </div>

                      <p className="text-white text-sm font-semibold mb-0.5">
                        {String(show.start_time ?? '').slice(0, 5)}
                        {show.end_time ? ` – ${String(show.end_time).slice(0, 5)}` : ''}
                      </p>
                      <p className="text-zinc-500 text-xs">{show.date}</p>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-white text-sm font-bold">
                          {Number(show.charge) === 0 ? 'Free' : `₹${show.charge}`}
                        </span>
                        {bookings.some((b) => b.show?.id === show.id) ? (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-400">
                            Waiting for confirmation
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={bookingShowId === show.id || show.available_spots <= 0}
                            onClick={() => handleBook(show.id)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#0a1628] text-white hover:bg-[#38bdf8] hover:text-black motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97] min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {bookingShowId === show.id ? 'Booking…' : 'Book Spot'}
                          </button>
                        )}
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              )}

              <h2 className="text-lg font-bold text-white mb-4 mt-8">Open Spots</h2>
              {applyError ? <p className="mb-4 text-sm text-red-400">{applyError}</p> : null}

              {spots.length === 0 ? (
                <p className="text-zinc-500 text-sm">No open spots at this venue.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {spots.map((spot) => {
                    const existingRequest = spotRequests.find(
                      (r) => r.spot_id === spot.id && r.status !== 'cancelled_by_comedian'
                    );
                    return (
                      <SpotlightCard key={spot.id} className="rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              spot.spot_type === 'busking'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {spot.spot_type === 'busking' ? 'Busking' : 'Non-Busking'}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              spot.available_spots <= 3 ? 'text-red-400' : 'text-green-400'
                            }`}
                          >
                            {spot.available_spots} spots left
                          </span>
                        </div>

                        <p className="text-white text-sm font-semibold mb-0.5">
                          {spot.start_time.slice(0, 5)} – {spot.end_time.slice(0, 5)}
                        </p>
                        <p className="text-zinc-500 text-xs">{spot.date}</p>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-white text-sm font-bold">
                            {spot.price ? `₹${spot.price}` : 'Free'}
                          </span>
                          {existingRequest ? (
                            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-400">
                              {SPOT_REQUEST_STATUS_LABEL[existingRequest.status] ?? existingRequest.status}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={applyingSpotId === spot.id || spot.available_spots <= 0}
                              onClick={() => handleApply(spot.id)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#0a1628] text-white hover:bg-[#38bdf8] hover:text-black motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97] min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {applyingSpotId === spot.id ? 'Applying…' : 'Apply'}
                            </button>
                          )}
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
