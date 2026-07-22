'use client';

import { useAuth } from '../../context/AuthContext';

export function VenueOwnerProfile() {
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
        <h1 className="mt-4 text-2xl font-bold text-white">{user.venueName ?? 'My Venue'}</h1>
        <span className="mt-2 rounded-full bg-teal-500/20 px-3 py-1 text-center text-xs font-medium text-teal-400">
          Venue Owner
        </span>
        <p className="mt-1 text-sm text-zinc-500">Producer: {user.name}</p>
      </div>
    </section>
  );
}
