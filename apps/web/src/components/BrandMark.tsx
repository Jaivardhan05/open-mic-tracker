import Link from "next/link";

interface BrandMarkProps {
  variant?: "nav" | "hero";
  className?: string;
}

export default function BrandMark({ variant = "nav", className = "" }: BrandMarkProps) {
  return (
    <Link
      href="/home"
      aria-label="OpenMic Delhi, go to home"
      className={`brand-mark brand-mark-${variant} ${className} motion-safe:transition-transform motion-safe:duration-75 motion-safe:active:scale-[0.97] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
    >
      <span className="brand-openmic">OPENMIC</span>
      <span className="brand-tilde">~</span>
      <span className="brand-delhi">Delhi</span>
    </Link>
  );
}
