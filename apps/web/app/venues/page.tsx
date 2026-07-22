"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Show, Venue } from '@repo/types';

import Navbar from '../../src/components/Navbar';
import Sidebar from '../../src/components/Sidebar';
import { useAuth } from '../../src/context/AuthContext';
import { FilterPills, type SpotTypeFilter } from '../../src/components/venues/FilterPills';
import { VenueListCard } from '../../src/components/venues/VenueListCard';
import { useVisible } from '../../src/hooks/useVisible';
import { IconClose, IconSearch } from '../../src/components/icons/NavIcons';
import { matchesVenueSearch } from '../../src/lib/venueSearch';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function VenuesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpotType, setFilterSpotType] = useState<SpotTypeFilter>('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterFreeOnly, setFilterFreeOnly] = useState(false);
  const [filterTonightOnly, setFilterTonightOnly] = useState(false);

  const [gridRef, gridVisible] = useVisible(0.05);

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
          fetch('/api/venues'),
          fetch('/api/shows'),
        ]);
        const venuesData = await venuesRes.json();
        const showsData = await showsRes.json();
        setVenues(Array.isArray(venuesData) ? venuesData : []);
        setShows(Array.isArray(showsData) ? showsData : []);
      } catch {
        setError('Failed to load venues.');
      } finally {
        setIsFetching(false);
      }
    }
    void fetchAll();
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(venues.map((v) => v.city).filter(Boolean))),
    [venues],
  );

  const today = useMemo(() => todayISO(), []);

  const filteredVenues = venues.filter((v) => {
    const matchesSearch = matchesVenueSearch(v, searchQuery);

    const venueShows = shows.filter((s) => s.venue_id === v.id);

    const matchesSpotType =
      filterSpotType === 'all' || venueShows.some((s) => s.spot_type === filterSpotType);

    const matchesCity = filterCity === 'all' || v.city === filterCity;

    const matchesFree = !filterFreeOnly || venueShows.some((s) => Number(s.charge ?? 0) === 0);

    const matchesTonight = !filterTonightOnly || venueShows.some((s) => s.date === today);

    return matchesSearch && matchesSpotType && matchesCity && matchesFree && matchesTonight;
  });

  function handleSidebarFilter(query: string) {
    if (query === 'busking spots') setFilterSpotType('busking');
    else if (query === 'free spots') setFilterFreeOnly(true);
    else if (query === 'spots tonight') setFilterTonightOnly(true);
  }

  const subtitle =
    filterCity !== 'all'
      ? `${filteredVenues.length} venues in ${filterCity}`
      : cities.length <= 1
      ? `${filteredVenues.length} venues${cities[0] ? ` in ${cities[0]}` : ''}`
      : `${filteredVenues.length} venues across ${cities.length} cities`;

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
    <>
      <style>{`
        .content-glass {
          backdrop-filter: blur(40px) saturate(120%);
          -webkit-backdrop-filter: blur(40px) saturate(120%);
        }
        .spotlight-card-wrap:hover .content-glass {
          border-color: rgba(255, 255, 255, 0.26);
          transition: border-color 0.3s ease;
        }
      `}</style>

      <div className="layout-root">
        <Navbar />
        <div className="flex">
          <Sidebar onFilter={handleSidebarFilter} />

          <main
            className="main-content-glass sidebar-content-margin lg:ml-[var(--sidebar-w)] overflow-y-auto w-full"
            style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
          >
            <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">All Venues</h1>
                <p className="brand-delhi mt-1" style={{ color: '#38bdf8', fontSize: '1.05rem' }}>
                  {subtitle}
                </p>
              </div>

              <div className="flex flex-col gap-4 mb-8">
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search venues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="content-glass w-full rounded-xl pl-10 pr-10 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#38bdf8] min-h-[44px] backdrop-blur-[12px]"
                  />
                  {searchQuery !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white motion-safe:transition-colors"
                    >
                      <IconClose className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <FilterPills
                  spotType={filterSpotType}
                  onSpotTypeChange={setFilterSpotType}
                  freeOnly={filterFreeOnly}
                  onFreeOnlyToggle={() => setFilterFreeOnly((v) => !v)}
                  tonightOnly={filterTonightOnly}
                  onTonightOnlyToggle={() => setFilterTonightOnly((v) => !v)}
                  cities={cities}
                  city={filterCity}
                  onCityChange={setFilterCity}
                />
              </div>

              {isFetching ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="content-glass rounded-2xl overflow-hidden animate-pulse">
                      <div className="aspect-video bg-white/5" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-white/5 rounded w-3/4" />
                        <div className="h-3 bg-white/5 rounded w-1/2" />
                        <div className="h-3 bg-white/5 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center text-red-400 mt-20">{error}</div>
              ) : filteredVenues.length === 0 ? (
                <div className="flex flex-col items-center text-center text-zinc-500 mt-20">
                  <IconSearch className="w-12 h-12 text-zinc-700 mb-4" />
                  No venues found matching your search.
                </div>
              ) : (
                <div
                  ref={gridRef}
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                >
                  {filteredVenues.map((venue, index) => {
                    const venueShows = shows.filter((s) => s.venue_id === venue.id);
                    return (
                      <VenueListCard
                        key={venue.id}
                        venue={venue}
                        shows={venueShows}
                        index={index}
                        visible={gridVisible}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
