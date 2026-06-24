interface BrandMarkProps {
  variant?: "nav" | "hero";
  className?: string;
}

export default function BrandMark({ variant = "nav", className = "" }: BrandMarkProps) {
  return (
    <span className={`brand-mark brand-mark-${variant} ${className}`}>
      <span className="brand-openmic">OPENMIC</span>
      <span className="brand-tilde">~</span>
      <span className="brand-delhi">Delhi</span>
    </span>
  );
}
