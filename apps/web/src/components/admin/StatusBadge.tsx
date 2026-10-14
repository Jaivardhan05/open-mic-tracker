import type { VenueDisplayStatus } from "@repo/types";

import { STATUS_META } from "@/lib/venueStatus";

import StatusIcon from "./StatusIcons";

interface StatusBadgeProps {
  status: VenueDisplayStatus;
  className?: string;
}

// Icon + label + flat tint. Suspended is an outline (transparent fill) so it
// reads as the strongest state next to the tinted rejected badge.
export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { label, color } = STATUS_META[status];
  const outlined = status === "suspended";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${className}`}
      style={{
        color,
        backgroundColor: outlined ? "transparent" : `${color}1f`,
        border: `1px solid ${outlined ? color : "transparent"}`,
      }}
    >
      <StatusIcon status={status} className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
