"use client";

import { useCallback, useRef } from 'react';

// SVG fractal-noise tile, URL-encoded for use as a data URI background-image.
// Creates a subtle grain texture that adds tactile depth to cards.
const NOISE_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Glassmorphic card with:
//   - SVG grain noise overlay (texture / depth)
//   - Cursor-tracking radial spotlight (physical light feeling)
//   - Subtle 3-D tilt on hover (perceived depth)
// All effects skip automatically for prefers-reduced-motion users.
export function SpotlightCard({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  // Read once on mount — avoids re-querying matchMedia on every mouse move.
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const spot = spotRef.current;
    if (!card || !spot) return;
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    // Spotlight
    spot.style.opacity = '1';
    spot.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.07) 0%, transparent 65%)`;
    // 3-D tilt (skipped for reduced-motion)
    if (!reduced.current) {
      const rx = (y / 100 - 0.5) * -4;
      const ry = (x / 100 - 0.5) * 4;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      card.style.transition = 'transform 0.07s linear';
    }
  }, []);

  const onLeave = useCallback(() => {
    const spot = spotRef.current;
    const card = cardRef.current;
    if (spot) spot.style.opacity = '0';
    if (card && !reduced.current) {
      card.style.transform = '';
      card.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
  }, []);

  return (
    <div
      ref={cardRef}
      className={`content-glass relative overflow-hidden ${className}`}
      style={{ ...style, willChange: 'transform' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: NOISE_URI,
          backgroundRepeat: 'repeat',
          opacity: 0.055,
          mixBlendMode: 'soft-light' as React.CSSProperties['mixBlendMode'],
        }}
        aria-hidden="true"
      />
      {/* Cursor spotlight */}
      <div
        ref={spotRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.35s ease' }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
