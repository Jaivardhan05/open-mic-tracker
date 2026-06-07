"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import { useAuth } from "../../src/context/AuthContext";

export default function VenueDashboardPage() {
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

    if (user.role !== "venue_producer") {
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

  if (!user || user.role !== "venue_producer") {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 pb-12 pt-24 text-center">
        <h1 className="text-2xl font-bold text-white">Welcome, {user.venueName ?? user.name}</h1>
        <span className="mt-3 inline-flex rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300">
          Venue Producer
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

        <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="mb-4 text-4xl">⏳</p>
          <h2 className="text-lg font-semibold text-white">Pending Approval</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Our team is reviewing your venue. You can update your venue details while you wait.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-[#F97316] px-6 py-3 font-bold text-white transition-colors hover:bg-[#EA6C00]"
          >
            Update Venue Profile
          </button>
        </div>
      </section>
    </main>
  );
}