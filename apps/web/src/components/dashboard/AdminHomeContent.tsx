"use client";

import { useEffect, useState } from "react";

import BrandMark from "@/components/BrandMark";
import CtaButton from "@/components/CtaButton";
import ManageVenuesSection from "@/components/admin/ManageVenuesSection";
import { useAuth } from "@/context/AuthContext";

// Matches RequestsPanel's solid dark-navy panel fill (specs/venue-dashboard.md §5.3) —
// the locked treatment this panel replicates.
const PANEL_BG = "rgba(6,12,32,0.97)";
const CARD_BG = "rgba(19,30,58,0.92)";

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
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total_venues}</p>
            <p className="mt-1 font-[family-name:var(--font-bebas)] text-xs uppercase tracking-wide text-zinc-500">
              Total Venues
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="text-2xl font-bold text-white">{stats.pending_approvals}</div>
                {stats.pending_approvals > 0 && (
                  <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500" />
                )}
              </div>
            </div>
            <p className="mt-1 font-[family-name:var(--font-bebas)] text-xs uppercase tracking-wide text-zinc-500">
              Pending Approvals
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 px-4 md:px-6">
        <div
          className="surface-grain rounded-2xl border border-white/[0.08] p-5 md:p-6"
          style={{
            backgroundColor: PANEL_BG,
            backdropFilter: "blur(40px) saturate(140%)",
            WebkitBackdropFilter: "blur(40px) saturate(140%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.65)",
          }}
        >
          <div className="mb-4 flex items-center">
            <h2 className="font-[family-name:var(--font-bebas)] text-2xl uppercase tracking-[0.04em] text-white">
              Pending Approvals
            </h2>
            <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              {pendingVenues.length}
            </span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-zinc-500">Loading pending approvals...</div>
          ) : pendingVenues.length === 0 ? (
            <p className="pl-3 text-xs text-zinc-500">No venues pending approval.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pendingVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="notch-entry rounded-xl py-3.5 pl-5 pr-3.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]"
                  style={
                    {
                      backgroundColor: CARD_BG,
                      "--notch-bg": PANEL_BG,
                    } as React.CSSProperties
                  }
                >
                  <p className="text-base font-bold tracking-tight text-white">{venue.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">{venue.address}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
                    Owner: {venue.ownerName} &middot; {venue.ownerEmail}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-600">
                    Submitted {new Date(venue.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-amber-400/30 pt-3 sm:flex-row">
                    <CtaButton
                      type="button"
                      disabled={approvingId === venue.id}
                      className="min-h-[44px] flex-1 justify-center"
                      onClick={() => void handleApprove(venue.id)}
                    >
                      {approvingId === venue.id ? "Approving…" : "Approve"}
                    </CtaButton>
                    <CtaButton
                      type="button"
                      variant="danger"
                      disabled={rejectingId === venue.id}
                      className="min-h-[44px] flex-1 justify-center"
                      onClick={() => void handleReject(venue.id)}
                    >
                      {rejectingId === venue.id ? "Rejecting…" : "Reject"}
                    </CtaButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ManageVenuesSection />
    </>
  );
}
