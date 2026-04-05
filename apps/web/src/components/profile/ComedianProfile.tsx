'use client';

export function ComedianProfile() {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-black/30 p-4 md:p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700 text-3xl text-zinc-400">
          JD
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">Jaivardhan</h1>
        <span className="mt-2 rounded-full bg-[#F97316]/20 px-3 py-1 text-center text-xs font-medium text-[#F97316]">
          Comedian
        </span>
        <p className="mt-1 text-sm text-zinc-500">Delhi</p>
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
          className="mt-4 w-full rounded-xl bg-[#F97316] py-3 font-bold text-white transition-colors hover:bg-[#EA6C00]"
        >
          Find a Spot
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Profile Details</h2>

        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Name</p>
          <p className="text-sm text-white">-</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Email</p>
          <p className="text-sm text-white">-</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">Phone</p>
          <p className="text-sm text-white">-</p>
        </div>
        <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="mb-1 text-xs text-zinc-500">City</p>
          <p className="text-sm text-white">-</p>
        </div>
      </div>
    </section>
  );
}
