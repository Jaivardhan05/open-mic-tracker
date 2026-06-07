'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

interface PendingVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  owner_id: string;
  created_at: string;
  ownerName?: string;
  ownerEmail?: string;
}

interface ApprovedVenue {
  id: string;
  name: string;
  city: string;
  admin_approved: boolean;
  verified: boolean;
  created_at: string;
}

interface AdminStats {
  total_venues: number;
  pending_approvals: number;
  total_shows: number;
  total_bookings: number;
  total_comedians: number;
  total_venue_owners: number;
}

export function AdminProfile() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    total_venues: 0,
    pending_approvals: 0,
    total_shows: 0,
    total_bookings: 0,
    total_comedians: 0,
    total_venue_owners: 0,
  });
  const [pendingVenues, setPendingVenues] = useState<PendingVenue[]>([]);
  const [allVenues, setAllVenues] = useState<ApprovedVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdminData() {
      setIsLoading(true);
      try {
        const statsRes = await fetch(`${API_URL}/api/admin/stats`);
        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as AdminStats;
          setStats(statsData);
        }

        const pendingRes = await fetch(`${API_URL}/api/admin/pending-venues`);
        if (pendingRes.ok) {
          const pendingData = (await pendingRes.json()) as PendingVenue[];
          setPendingVenues(pendingData);
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

  async function handleApprove(venueId: string) {
    setApprovingId(venueId);
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/approve`, { method: 'POST' });

      if (res.ok) {
        setPendingVenues((prev) => prev.filter((v) => v.id !== venueId));
        setStats((prev) => ({
          ...prev,
          pending_approvals: Math.max(0, prev.pending_approvals - 1),
          total_venues: prev.total_venues + 1,
        }));
        setAllVenues((prev) =>
          prev.map((v) => (v.id === venueId ? { ...v, admin_approved: true, verified: true } : v))
        );
      } else {
        console.error('Approve failed');
      }
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(venueId: string) {
    setRejectingId(venueId);
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/reject`, { method: 'POST' });
      if (res.ok) {
        setPendingVenues((prev) => prev.filter((v) => v.id !== venueId));
        setStats((prev) => ({
          ...prev,
          pending_approvals: Math.max(0, prev.pending_approvals - 1),
        }));
        setAllVenues((prev) => prev.filter((v) => v.id !== venueId));
      }
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setRejectingId(null);
    }
  }

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
          <p className="text-2xl font-bold text-white">{stats.total_venues}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Venues</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="text-2xl font-bold text-white">{stats.pending_approvals}</div>
              {stats.pending_approvals > 0 && (
                <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500" />
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Pending Approvals</p>
        </div>
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
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
          <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
            {pendingVenues.length}
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading pending approvals...</div>
        ) : pendingVenues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
            No venues pending approval.
          </div>
        ) : (
          <div>
            {pendingVenues.map((venue) => (
              <div key={venue.id} className="mb-3 rounded-2xl border border-zinc-700 bg-zinc-800 p-4">
                <h3 className="text-base font-semibold text-white">{venue.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-400">{venue.address}</p>
                <div className="mt-2 text-xs text-zinc-500">
                  <p>Owner: {venue.ownerName}</p>
                  <p>{venue.ownerEmail}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Submitted {new Date(venue.created_at).toLocaleDateString()}
                </p>
                <div className="mt-3 flex">
                  <button
                    type="button"
                    onClick={() => void handleApprove(venue.id)}
                    disabled={approvingId === venue.id}
                    className="mr-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                  >
                    {approvingId === venue.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(venue.id)}
                    disabled={rejectingId === venue.id}
                    className="rounded-xl border border-red-800 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900 disabled:opacity-50"
                  >
                    {rejectingId === venue.id ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
