"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { notFound, useRouter } from "next/navigation";

import CtaButton from "@/components/CtaButton";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { authorizedFetch } from "@/lib/apiClient";

type GuardState = "checking" | "allowed" | "denied" | "error";

// Admin-only gate for everything under /admin. The decision comes from the
// server (GET /api/admin/me, role looked up in the DB), never from the
// localStorage user, which anyone can edit. Until the server says yes the
// page renders nothing but a loading line, so no admin UI is ever mounted for
// anyone else. Every admin API call is independently authorized server-side;
// this guard only keeps the UI out of other roles' hands.
//   - logged out        -> /auth
//   - signed in, not admin -> the standard 404 (does not reveal the route)
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  const verify = useCallback(async () => {
    setState("checking");
    try {
      const res = await authorizedFetch("/api/admin/me");
      if (res.ok) {
        setState("allowed");
      } else if (res.status === 401) {
        router.replace("/auth");
      } else if (res.status === 403) {
        setState("denied");
      } else {
        setState("error");
      }
    } catch (err) {
      // authorizedFetch throws when there is no Supabase session at all.
      if (err instanceof Error && /session/i.test(err.message)) {
        router.replace("/auth");
      } else {
        setState("error");
      }
    }
  }, [router]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    void verify();
  }, [isAuthLoading, user, router, verify]);

  if (state === "denied") {
    notFound();
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <p className="text-sm text-zinc-400">We couldn&apos;t confirm your access. Check your connection and try again.</p>
        <CtaButton type="button" onClick={() => void verify()}>
          Try again
        </CtaButton>
      </div>
    );
  }

  if (state !== "allowed" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="layout-root">
      <Navbar />
      <Sidebar onFilter={() => {}} />

      <main
        className="main-content-glass sidebar-content-margin pb-12 text-gray-100 lg:ml-[var(--sidebar-w)] overflow-y-auto"
        style={{ height: "calc(100dvh - 3.5rem)", marginTop: "3.5rem" }}
      >
        {children}
      </main>
    </div>
  );
}
