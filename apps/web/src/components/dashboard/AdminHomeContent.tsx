"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import BrandMark from "@/components/BrandMark";
import CtaButton from "@/components/CtaButton";
import { useAuth } from "@/context/AuthContext";
import { authorizedFetch } from "@/lib/apiClient";

interface AdminHomeStats {
  total_venues: number;
  pending_approvals: number;
}

const TILE =
  "glass-panel block rounded-2xl p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]";
const TILE_LABEL = "mt-1 font-[family-name:var(--font-bebas)] text-xs uppercase tracking-wide text-zinc-500";

// Venue review lives on /admin/venues; this page is the entry point: two counts
// that both open it. A failed or pending stats call shows "–", not a false 0.
export default function AdminHomeContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminHomeStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await authorizedFetch(`/api/admin/stats`);
        if (res.ok) setStats((await res.json()) as AdminHomeStats);
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      }
    }

    void fetchStats();
  }, []);

  if (!user) {
    return null;
  }

  const total = stats ? String(stats.total_venues) : "–";
  const pending = stats ? String(stats.pending_approvals) : "–";

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
          <Link href="/admin/venues" className={TILE} aria-label={`${total} total venues. Open venue management.`}>
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className={TILE_LABEL}>Total Venues</p>
          </Link>
          <Link
            href="/admin/venues"
            className={TILE}
            aria-label={`${pending} pending approvals. Open venue management.`}
          >
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="text-2xl font-bold text-white">{pending}</div>
                {stats && stats.pending_approvals > 0 && (
                  <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500" />
                )}
              </div>
            </div>
            <p className={TILE_LABEL}>Pending Approvals</p>
          </Link>
        </div>

        <div className="mt-4 flex justify-center">
          <CtaButton type="button" className="min-h-[44px]" onClick={() => router.push("/admin/venues")}>
            Manage venues
          </CtaButton>
        </div>
      </section>
    </>
  );
}
