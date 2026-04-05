'use client';

type PendingVenue = {
  id: string;
  name: string;
  address: string;
  owner: string;
};

type VenueRow = {
  id: string;
  name: string;
  city: string;
  status: 'approved' | 'pending';
};

const pendingVenues: PendingVenue[] = [];
const allVenues: VenueRow[] = [];

export function AdminProfile() {
  const stats = {
    totalVenues: 0,
    pendingApproval: 0,
    totalComedians: 0,
    totalBookings: 0,
  };

  return (
    <section className="rounded-3xl border border-zinc-800 bg-black/30 p-4 md:p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-700 text-3xl text-zinc-400">
          JD
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">Jaivardhan</h1>
        <span className="mt-2 rounded-full bg-red-500/20 px-3 py-1 text-center text-xs font-medium text-red-400">
          Admin
        </span>
        <p className="mt-1 text-sm text-zinc-500">Delhi</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalVenues}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Venues</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <p className="text-2xl font-bold text-white">{stats.pendingApproval}</p>
            {stats.pendingApproval > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Pending Approval</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalComedians}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Comedians</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.totalBookings}</p>
          <p className="mt-1 text-xs text-zinc-500">Total Bookings</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center">
          <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
          <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
            {stats.pendingApproval}
          </span>
        </div>

        {pendingVenues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-600">
            No venues pending approval.
          </div>
        ) : (
          <div>
            {pendingVenues.map((venue) => (
              <div key={venue.id} className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-base font-semibold text-white">{venue.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{venue.address}</p>
                <p className="mt-1 text-xs text-zinc-500">Owner: {venue.owner}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-red-800 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">All Venues</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {allVenues.length === 0 ? (
            <div className="p-6 text-sm text-zinc-600">No venues available.</div>
          ) : (
            allVenues.map((venue) => (
              <div
                key={venue.id}
                className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-white">{venue.name}</p>
                  <p className="text-xs text-zinc-500">{venue.city}</p>
                </div>
                <span
                  className={
                    'rounded-full px-2.5 py-1 text-xs font-medium ' +
                    (venue.status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-amber-500/20 text-amber-400')
                  }
                >
                  {venue.status === 'approved' ? 'Approved' : 'Pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">By City</h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white">Delhi</p>
            <p className="text-sm text-zinc-400">0 venues</p>
          </div>
        </div>
      </div>
    </section>
  );
}
