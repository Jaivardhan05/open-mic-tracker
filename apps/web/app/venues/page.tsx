"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Navbar from '../../src/components/Navbar';
import Sidebar from '../../src/components/Sidebar';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function VenuesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [venues, setVenues] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpotType, setFilterSpotType] = useState<'all' | 'busking' | 'non_busking'>('all');
  const [filterCity] = useState('all');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    async function fetchAll() {
      setIsFetching(true);
      try {
        const [venuesRes, showsRes] = await Promise.all([
          fetch(`${API_URL}/api/venues`),
          fetch(`${API_URL}/api/shows`),
        ]);
        const venuesData = await venuesRes.json();
        const showsData = await showsRes.json();
        setVenues(venuesData ?? []);
        setShows(showsData ?? []);
      } catch {
        setError('Failed to load venues.');
      } finally {
        setIsFetching(false);
      }
    }
    void fetchAll();
  }, []);

  const filteredVenues = venues.filter((v) => {
    const name = String(v.name ?? '').toLowerCase();
    const address = String(v.address ?? '').toLowerCase();
    const city = String(v.city ?? '').toLowerCase();

    const matchesSearch =
      searchQuery === '' || name.includes(searchQuery.toLowerCase()) || address.includes(searchQuery.toLowerCase());

    const venueShows = shows.filter((s) => s.venue_id === v.id);

    const matchesSpotType =
      filterSpotType === 'all' || venueShows.some((s) => s.spot_type === filterSpotType);

    const matchesCity = filterCity === 'all' || city === filterCity.toLowerCase();

    return matchesSearch && matchesSpotType && matchesCity;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="flex">
        <Sidebar onFilter={() => {}} />

        <main className="md:ml-56 pt-14 px-4 md:px-8 py-8 w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">All Venues</h1>
            <p className="text-zinc-500 text-sm mt-1">{filteredVenues.length} venues in Delhi</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <input
              type="text"
              placeholder="Search venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] min-h-[44px]"
            />

            <div className="flex gap-2">
              {(['all', 'busking', 'non_busking'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterSpotType(type)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
                    filterSpotType === type
                      ? 'bg-[#F97316] text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'busking' ? 'Busking' : 'Non-Busking'}
                </button>
              ))}
            </div>
          </div>

          {isFetching ? (
            <div className="animate-spin w-8 h-8 rounded-full border-2 border-zinc-700 border-t-[#F97316] mx-auto mt-20" />
          ) : error ? (
            <div className="text-center text-red-400 mt-20">{error}</div>
          ) : filteredVenues.length === 0 ? (
            <div className="text-center text-zinc-500 mt-20">No venues found matching your search.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVenues.map((venue) => {
                const venueShows = shows.filter((s) => s.venue_id === venue.id);
                const totalSpots = venueShows.reduce(
                  (sum, s) => sum + Number(s.available_spots ?? 0),
                  0
                );

                return (
                  <div
                    key={venue.id}
                    className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors duration-200"
                    onClick={() => router.push(`/venues/${venue.id}`)}
                  >
                    <div className="relative aspect-video">
                      <img
                        src={
                          venue.photos?.[0] ??
                          `https://picsum.photos/seed/${venue.id}/600/400`
                        }
                        alt={venue.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-4">
                      <h3 className="font-bold text-white text-base mb-1 line-clamp-1">{venue.name}</h3>

                      <p className="text-zinc-500 text-xs mb-3 line-clamp-1">{venue.address}</p>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {venueShows.slice(0, 3).map((show) => (
                          <span
                            key={show.id}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              show.spot_type === 'busking'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {String(show.start_time ?? '').slice(0, 5)}
                          </span>
                        ))}
                        {venueShows.length === 0 && (
                          <span className="text-xs text-zinc-600">No upcoming shows</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {venueShows.some((s) => Number(s.charge ?? 0) === 0)
                            ? 'Free'
                            : venueShows.length > 0
                            ? `From ₹${Math.min(...venueShows.map((s) => Number(s.charge ?? 0)))}`
                            : '—'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            venueShows.some((s) => Number(s.available_spots ?? 0) <= 3)
                              ? 'text-red-400'
                              : 'text-green-400'
                          }`}
                        >
                          {totalSpots} spots left
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
