"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../src/context/AuthContext";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.push("/auth");
      return;
    }

    switch (user.role) {
      case "comedian":
        router.push("/home");
        break;
      case "venue_producer":
        router.push("/venue-dashboard");
        break;
      case "admin":
        router.push("/admin-dashboard");
        break;
      default:
        router.push("/auth");
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-sm text-zinc-500">Loading...</div>
    </div>
  );
}
