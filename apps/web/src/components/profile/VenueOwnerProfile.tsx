'use client';

export function VenueOwnerProfile() {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-black/30 p-4 md:p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700 text-3xl text-zinc-400">
          JD
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">Jaivardhan</h1>
        <span className="mt-2 rounded-full bg-teal-500/20 px-3 py-1 text-center text-xs font-medium text-teal-400">
          Venue Owner
        </span>
        <p className="mt-1 text-sm text-zinc-500">Delhi</p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">My Venues</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Active Shows</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Total Bookings</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">My Venues</h2>
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
          No venues registered yet.
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-[#F97316] py-3 font-bold text-white transition-colors hover:bg-[#EA6C00]"
        >
          Register a Venue
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Upcoming Shows</h2>
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
          No shows scheduled.
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-800 py-3 font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Add a Show
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Bookings for Your Venues</h2>
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
          No bookings yet.
        </div>
      </div>
    </section>
  );
}
