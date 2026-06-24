"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import { useAuth } from "../../src/context/AuthContext";

export default function AdminDashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.push("/auth");
      return;
    }

    if (user.role !== "admin") {
      router.push("/home");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <main className="layout-root text-white">
      <Navbar />

      <section className="main-content-glass min-h-screen px-4 pb-12 pt-24 backdrop-blur-[6px] backdrop-saturate-[110%]">
        <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <span className="mt-3 inline-flex rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
          Admin
        </span>
        <div>
          <button
            onClick={() => {
              logout();
              router.push('/auth');
            }}
            className="mt-4 px-6 py-2 rounded-xl text-sm font-medium bg-red-900/40 text-red-400 border border-red-800 hover:bg-red-900/60 transition-colors duration-200"
          >
            Log Out
          </button>
        </div>

        <div className="content-glass mt-8 rounded-2xl p-5 text-center backdrop-blur-[12px]">
          <p className="text-sm text-zinc-400">Live stats and venue moderation controls are available on your profile page.</p>
          <button
            onClick={() => router.push('/profile')}
            className="mt-6 w-full max-w-sm rounded-xl bg-[#F97316] py-3 font-bold text-white transition-colors hover:bg-[#EA6C00]"
          >
            View Full Admin Dashboard
          </button>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-white">Manage Platform</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl bg-[#F97316] px-5 py-3 font-bold text-white transition-colors hover:bg-[#EA6C00]"
          >
            Review Pending Venues
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-3 font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            View All Users
          </button>
        </div>
        </div>
      </section>
    </main>
  );
}
