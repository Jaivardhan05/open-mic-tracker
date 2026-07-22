"use client";

import { useEffect, useState } from "react";

import BrandMark from "@/components/BrandMark";
import ManageVenuesSection from "@/components/admin/ManageVenuesSection";
import { useAuth } from "@/context/AuthContext";

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

interface AdminHomeStats {
  total_venues: number;
  pending_approvals: number;
}

export default function AdminHomeContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminHomeStats>({ total_venues: 0, pending_approvals: 0 });
  const [pendingVenues, setPendingVenues] = useState<PendingVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdminData() {
      setIsLoading(true);
      try {
        const [statsRes, pendingRes] = await Promise.all([
          fetch(`/api/admin/stats`),
          fetch(`/api/admin/pending-venues`),
        ]);

        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as AdminHomeStats;
          setStats(statsData);
        }

        if (pendingRes.ok) {
          const pendingData = (await pendingRes.json()) as PendingVenue[];
          setPendingVenues(pendingData);
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAdminData();
  }, []);

  async function handleApprove(venueId: string) {
    setApprovingId(venueId);
    try {
      const res = await fetch(`/api/venues/${venueId}/approve`, { method: "POST" });
      if (res.ok) {
        setPendingVenues((prev) => prev.filter((v) => v.id !== venueId));
        setStats((prev) => ({
          ...prev,
          pending_approvals: Math.max(0, prev.pending_approvals - 1),
          total_venues: prev.total_venues + 1,
        }));
      }
    } catch (err) {
      console.error("Approve error:", err);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(venueId: string) {
    setRejectingId(venueId);
    try {
      const res = await fetch(`/api/venues/${venueId}/reject`, { method: "POST" });
      if (res.ok) {
        setPendingVenues((prev) => prev.filter((v) => v.id !== venueId));
        setStats((prev) => ({
          ...prev,
          pending_approvals: Math.max(0, prev.pending_approvals - 1),
        }));
      }
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      setRejectingId(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <section className="px-4 pt-12 text-center">
        <h1>
          <BrandMark variant="hero" />
        </h1>
        <p className="mt-3 text-base md:text-lg text-zinc-400">
          Welcome back, <span className="font-bold text-white">{user.name}</span>
        </p>
      </section>

      <section className="mt-8 px-4 md:px-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="content-glass rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total_venues}</p>
            <p className="mt-1 text-xs text-zinc-500">Total Venues</p>
          </div>
          <div className="content-glass rounded-2xl p-4 text-center">
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
        </div>
      </section>

      <section className="mt-8 px-4 md:px-6">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
          <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
            {pendingVenues.length}
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading pending approvals...</div>
        ) : pendingVenues.length === 0 ? (
          <div className="content-glass rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-600">
            No venues pending approval.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingVenues.map((venue) => (
              <div key={venue.id} className="content-glass rounded-2xl p-4">
                <h3 className="text-base font-semibold text-white">{venue.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-400">{venue.address}</p>
                <div className="mt-2 text-xs text-zinc-500">
                  <p>Owner: {venue.ownerName}</p>
                  <p>{venue.ownerEmail}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Submitted {new Date(venue.created_at).toLocaleDateString()}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprove(venue.id)}
                    disabled={approvingId === venue.id}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                  >
                    {approvingId === venue.id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(venue.id)}
                    disabled={rejectingId === venue.id}
                    className="flex-1 rounded-xl border border-red-800 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900 disabled:opacity-50"
                  >
                    {rejectingId === venue.id ? "Rejecting..." : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ManageVenuesSection />
    </>
  );
}
