"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import type { Show, Venue } from '@repo/types';

import Navbar from '../../../src/components/Navbar';
import Sidebar from '../../../src/components/Sidebar';
import { useAuth } from '../../../src/context/AuthContext';

export default function VenueDetailPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');

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
        const data: { venue: Venue; shows: Show[] } = await res.json();
        setVenue(data.venue);
        setShows(data.shows ?? []);
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

  return (
    <div className="layout-root">
      <Navbar />
      <div className="flex">
        <Sidebar onFilter={() => {}} />

        <main className="main-content-glass sidebar-content-margin lg:ml-[var(--sidebar-w)] min-h-screen mt-14 px-4 md:px-8 py-8 w-full">
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
              <div className="content-glass rounded-2xl overflow-hidden mb-6">
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
              </div>

              <h2 className="text-lg font-bold text-white mb-4">Upcoming Shows</h2>

              {shows.length === 0 ? (
                <p className="text-zinc-500 text-sm">No upcoming shows at this venue.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shows.map((show) => (
                    <div key={show.id} className="content-glass rounded-xl p-4">
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
                        <button
                          type="button"
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#0a1628] text-white hover:bg-[#38bdf8] hover:text-black motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97] min-h-[32px]"
                        >
                          Book Spot
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
