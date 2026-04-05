'use client';

import { useState } from 'react';

import { AdminProfile } from '@/components/profile/AdminProfile';
import { ComedianProfile } from '@/components/profile/ComedianProfile';
import { VenueOwnerProfile } from '@/components/profile/VenueOwnerProfile';

export default function ProfilePage() {
  const [role, setRole] = useState<'comedian' | 'venue_owner' | 'admin'>('comedian');

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRole('comedian')}
              className={
                'rounded-xl px-3 py-2 text-sm font-semibold transition-colors ' +
                (role === 'comedian'
                  ? 'bg-[#F97316] text-white'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800')
              }
            >
              Comedian
            </button>
            <button
              type="button"
              onClick={() => setRole('venue_owner')}
              className={
                'rounded-xl px-3 py-2 text-sm font-semibold transition-colors ' +
                (role === 'venue_owner'
                  ? 'bg-[#F97316] text-white'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800')
              }
            >
              Venue Owner
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={
                'rounded-xl px-3 py-2 text-sm font-semibold transition-colors ' +
                (role === 'admin'
                  ? 'bg-[#F97316] text-white'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800')
              }
            >
              Admin
            </button>
          </div>
        </div>

        {role === 'comedian' && <ComedianProfile />}
        {role === 'venue_owner' && <VenueOwnerProfile />}
        {role === 'admin' && <AdminProfile />}
      </div>
    </main>
  );
}
