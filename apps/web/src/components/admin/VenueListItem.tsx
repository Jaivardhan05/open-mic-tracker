import type { AdminManagedVenue } from "@repo/types";

import { STATUS_META, deriveDisplayStatus, statusReason } from "@/lib/venueStatus";

import ReasonNote from "./ReasonNote";
import StatusBadge from "./StatusBadge";
import StatusIcon from "./StatusIcons";

// Column layout shared by the header row and every item on md+; below md the
// item stacks into a card.
export const VENUE_ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_7rem] md:items-center md:gap-4";

interface VenueListItemProps {
  venue: AdminManagedVenue;
}

export default function VenueListItem({ venue }: VenueListItemProps) {
  const status = deriveDisplayStatus(venue);
  const { color } = STATUS_META[status];
  const alsoHidden = venue.is_hidden && status !== "hidden";

  return (
    <li className={`relative py-4 pl-5 pr-4 ${VENUE_ROW_GRID}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{venue.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{venue.city}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
        <StatusBadge status={status} />
        {alsoHidden ? (
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
            <StatusIcon status="hidden" className="h-3.5 w-3.5" />
            Also hidden
          </span>
        ) : null}
      </div>

      <p className="mt-2 truncate text-xs text-zinc-400 md:mt-0">
        {venue.owner_name ?? "Unknown owner"}
        {venue.owner_email ? <span className="text-zinc-600"> &middot; {venue.owner_email}</span> : null}
      </p>

      <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-600 md:mt-0 md:text-right">
        {new Date(venue.updated_at).toLocaleDateString()}
      </p>

      <ReasonNote reason={statusReason(venue)} color={color} className="mt-3 md:col-span-4" />
    </li>
  );
}
