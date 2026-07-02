'use client';

import { useAuth } from '../../context/AuthContext';

export function ComedianProfile() {
  const { user } = useAuth();

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
        <span className="mt-2 rounded-full bg-[#38bdf8]/20 px-3 py-1 text-center text-xs font-medium text-[#38bdf8]">
          Comedian
        </span>
        <p className="mt-1 text-sm text-zinc-500">{user.city}</p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Bookings</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Shows attended</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Favourite venues</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Upcoming Bookings</h2>
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
          No upcoming bookings yet. Find a spot and book it!
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-[#38bdf8] py-3 font-bold text-white transition-colors hover:bg-[#0ea5e9]"
        >
          Find a Spot
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Profile Details</h2>

        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Name</p>
          <p className="text-sm text-white">{user.name}</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Email</p>
          <p className="text-sm text-white">{user.email}</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Phone</p>
          <p className="text-sm text-white">{user.phone}</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">City</p>
          <p className="text-sm text-white">{user.city}</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Username</p>
          <p className="text-sm text-white">{user.username ?? '-'}</p>
        </div>
      </div>
    </section>
  );
}
