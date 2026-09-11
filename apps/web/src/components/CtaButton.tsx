"use client";

import type { ButtonHTMLAttributes } from "react";

interface CtaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Keeps the underline + arrow in their hover position, for use as an active tab/toggle state. */
  active?: boolean;
  /**
   * Recolors the label/underline/arrow: "danger" for destructive actions,
   * "busking" mirrors the busking-spot pink used on /venues, "free" mirrors
   * the green used for free-price toggles, "hosting" mirrors the flat
   * yellow used for the hosting spot pool (AddShowForm/EditShowForm/
   * VenueShowCard — see specs/venue-dashboard.md §9.4).
   */
  variant?: "default" | "danger" | "busking" | "free" | "hosting";
}

const VARIANT_CLASS: Record<NonNullable<CtaButtonProps["variant"]>, string> = {
  default: "",
  danger: "cta-danger",
  busking: "cta-busking",
  free: "cta-free",
  hosting: "cta-hosting",
};

export default function CtaButton({
  children,
  className = "",
  active = false,
  variant = "default",
  ...props
}: CtaButtonProps) {
  const classes = ["cta", active ? "cta-active" : "", VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={classes}>
      <span className="hover-underline-animation">{children}</span>
      <svg width="15px" height="10px" viewBox="0 0 13 10">
        <path d="M1,5 L11,5" />
        <polyline points="8 1 12 5 8 9" />
      </svg>
    </button>
  );
}
