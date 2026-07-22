"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ComedianHomeContent from "@/components/dashboard/ComedianHomeContent";
import VenueProducerDashboard from "@/components/venue-dashboard/VenueProducerDashboard";
import { useAuth } from "../../src/context/AuthContext";

export default function HomePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/auth");
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading) {
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
    <div className="layout-root">
      <Navbar />
      <Sidebar onFilter={() => {}} />

      <main
        className="main-content-glass sidebar-content-margin pb-12 text-gray-100 lg:ml-[var(--sidebar-w)] overflow-y-auto"
        style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
      >
        {user.role === "venue_producer" ? (
          <VenueProducerDashboard user={user} />
        ) : (
          <ComedianHomeContent />
        )}
      </main>
    </div>
  );
}
