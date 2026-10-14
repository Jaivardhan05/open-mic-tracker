import type { VenueDisplayStatus } from "@repo/types";

interface StatusIconProps {
  status: VenueDisplayStatus;
  className?: string;
}

// One outline glyph per venue status, so status never relies on color alone.
export default function StatusIcon({ status, className }: StatusIconProps) {
  const common = {
    className,
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (status) {
    case "pending":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      );
    case "approved":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="8.5 12.5 11 15 16 9.5" />
        </svg>
      );
    case "changes_requested":
      return (
        <svg {...common}>
          <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
      );
    case "rejected":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      );
    case "hidden":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 3l18 18" />
        </svg>
      );
    case "suspended":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9v6M14 9v6" />
        </svg>
      );
  }
}
