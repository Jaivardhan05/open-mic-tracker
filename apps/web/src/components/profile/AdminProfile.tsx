'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';


interface ApprovedVenue {
  id: string;
  name: string;
  city: string;
  admin_approved: boolean;
  verified: boolean;
  created_at: string;
}

interface AdminStats {
  total_shows: number;
  total_bookings: number;
  total_comedians: number;
  total_venue_owners: number;
}

export function AdminProfile() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    total_shows: 0,
    total_bookings: 0,
    total_comedians: 0,
    total_venue_owners: 0,
  });
  const [allVenues, setAllVenues] = useState<ApprovedVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminData() {
      setIsLoading(true);
      try {
        const statsRes = await fetch(`/api/admin/stats`);
        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as AdminStats;
          setStats(statsData);
        }

        const { data: allVenueData } = await supabase
          .from('venues')
          .select('id, name, city, admin_approved, verified, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (allVenueData) {
          setAllVenues(allVenueData as ApprovedVenue[]);
        }
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAdminData();
  }, []);

  if (!user) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-black/30 p-4 md:p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700 text-3xl text-zinc-400">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">{user.name}</h1>
        <span className="mt-2 rounded-full bg-red-500/20 px-3 py-1 text-center text-xs font-medium text-red-400">
          Admin
        </span>
        <p className="mt-1 text-sm text-zinc-500">Delhi</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.total_comedians}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Comedians</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.total_bookings}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Bookings</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">All Venues</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-zinc-500">Loading venues...</div>
          ) : allVenues.length === 0 ? (
            <div className="p-6 text-sm text-zinc-600">No venues registered yet.</div>
          ) : (
            allVenues.map((venue) => (
              <div
                key={venue.id}
                className="mb-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{venue.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{venue.city}</p>
                </div>
                <span
                  className={
                    'rounded-full px-2 py-1 text-xs ' +
                    (venue.admin_approved
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-amber-500/20 text-amber-400')
                  }
                >
                  {venue.admin_approved ? 'Approved' : 'Pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">By City</h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white">Delhi</p>
            <p className="text-sm text-zinc-400">0 venues</p>
          </div>
        </div>
      </div>
    </section>
  );
}
