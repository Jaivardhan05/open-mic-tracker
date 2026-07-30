"use client";

import type { ButtonHTMLAttributes } from "react";

interface CtaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Keeps the underline + arrow in their hover position, for use as an active tab/toggle state. */
  active?: boolean;
}

export default function CtaButton({ children, className = "", active = false, ...props }: CtaButtonProps) {
  const classes = ["cta", active ? "cta-active" : "", className].filter(Boolean).join(" ");

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
