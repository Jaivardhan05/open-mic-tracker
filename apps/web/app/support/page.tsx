"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../src/components/Navbar';

// SVG fractal-noise tile, URL-encoded for use as a data URI background-image.
// Creates a subtle grain texture that adds tactile depth to cards.
const NOISE_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Fires once when the element first enters the viewport, then disconnects.
function useVisible(threshold = 0.1) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

// Glassmorphic card with:
//   - SVG grain noise overlay (texture / depth)
//   - Cursor-tracking radial spotlight (physical light feeling)
//   - Subtle 3-D tilt on hover (perceived depth)
// All effects skip automatically for prefers-reduced-motion users.
function SpotlightCard({
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

// ─────────────────────────────────────────────────────────────────────────────

const SECTION_IDS = ['about', 'contact', 'faq'] as const;
type SectionId = (typeof SECTION_IDS)[number];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Returns opacity + translateY entrance styles with a per-element delay.
function enter(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px)' : 'translateY(18px)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  };
}

const FAQ_ITEMS = [
  {
    q: 'Is it free to sign up?',
    a: 'Yes. Creating a comedian account on OPENMIC ~ Delhi is completely free. Some shows may have a spot charge set by the venue, which is shown clearly on the booking page before you confirm.',
  },
  {
    q: 'How do I register my venue?',
    a: 'Click Sign Up on the login page and select Venue Producer. Fill in your venue name and contact details. Our team will review your application and approve it within 48 hours. Once approved, you can add shows and manage bookings from your venue dashboard.',
  },
  {
    q: 'What is a busking spot?',
    a: 'A busking spot means you perform and earn directly from audience tips - there is no fixed charge. A non-busking spot is a structured slot with a fixed fee set by the venue.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Cancellation policies vary by venue. Please contact the venue directly if you need to cancel. Refund support is coming soon.',
  },
  {
    q: 'Which cities are supported?',
    a: 'OPENMIC ~ Delhi currently covers venues across Delhi NCR. Mumbai, Bangalore, and Pune are planned for future expansion.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionId>('about');
  const [aboutRef, aboutVisible] = useVisible(0.08);
  const [contactRef, contactVisible] = useVisible(0.08);
  const [faqRef, faqVisible] = useVisible(0.08);

  // Sync active tab with scroll position via IntersectionObserver.
  useEffect(() => {
    const ratios = new Map<string, number>(SECTION_IDS.map((id) => [id, 0]));
    const thresholds = Array.from({ length: 11 }, (_, i) => i / 10);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(e.target.id, e.intersectionRatio));
        let best: SectionId = 'about';
        let bestRatio = -1;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) { bestRatio = ratio; best = id as SectionId; }
        });
        setActiveSection(best);
      },
      { threshold: thresholds },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // On load with a URL hash, smooth-scroll after the first paint.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && SECTION_IDS.includes(hash as SectionId)) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }, []);

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) {
    e.preventDefault();
    scrollToSection(id);
  }

  const tabLabels: Record<SectionId, string> = {
    about: 'How It Works',
    contact: 'Contact Us',
    faq: 'FAQ',
  };

  return (
    <>
      <style>{`
        /* Disable all motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition-duration: 0.001ms !important;
            animation-duration: 0.001ms !important;
          }
        }

        /* Tab nav ── sliding underline via CSS scaleX */
        .support-tab {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 0 0.875rem;
          min-height: 44px;
          font-size: 0.9375rem;
          font-weight: 600;
          border-radius: 6px;
          color: rgb(161, 161, 170);
          text-decoration: none;
          transition: color 0.2s ease, background-color 0.2s ease;
        }
        .support-tab::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 0.875rem;
          right: 0.875rem;
          height: 2px;
          border-radius: 2px;
          background: #38bdf8;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .support-tab[aria-current='true'] {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.05);
        }
        .support-tab[aria-current='true']::after {
          transform: scaleX(1);
        }
        .support-tab:not([aria-current='true']):hover {
          color: #e4e4e7;
          background-color: rgba(255, 255, 255, 0.03);
        }

        /* Section headings ── editorial left accent bar */
        .section-heading {
          position: relative;
          padding-left: 1rem;
        }
        .section-heading::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.15em;
          bottom: 0.15em;
          width: 3px;
          border-radius: 2px;
          background: #38bdf8;
        }

        /* Button ── diagonal light sweep on hover */
        .btn-sweep {
          position: relative;
          overflow: hidden;
        }
        .btn-sweep::before {
          content: '';
          position: absolute;
          inset: 0;
          left: -110%;
          width: 60%;
          background: rgba(255, 255, 255, 0.18);
          transform: skewX(-18deg);
          transition: left 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          pointer-events: none;
        }
        .btn-sweep:hover::before {
          left: 160%;
        }

        /* SpotlightCard hover border brightening via CSS (complement to the JS spotlight) */
        .spotlight-card-wrap:hover .content-glass {
          border-color: rgba(255, 255, 255, 0.26);
          transition: border-color 0.3s ease;
        }
      `}</style>

      <div
        className="layout-root"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.30)),url("/home-background-blue.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
          height: '100dvh',
        }}
      >
        <Navbar />

        <main
          className="text-white overflow-y-auto"
          style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
        >
          <div className="mx-auto max-w-4xl px-4 md:px-8 py-16">

            {/* ── Page header ──────────────────────────────── */}
            <div className="text-center mb-12">
              <h1
                className="brand-openmic mb-3"
                style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)', lineHeight: 1, letterSpacing: '0.03em' }}
              >
                Support
              </h1>
              <p
                className="brand-delhi mx-auto max-w-xl"
                style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', color: '#38bdf8' }}
              >
                Everything you need to know about OPENMIC ~ Delhi.
              </p>
            </div>

            {/* ── Section tab nav ───────────────────────────── */}
            <nav aria-label="Page sections" className="flex justify-center gap-1 mb-16">
              {SECTION_IDS.map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => handleNavClick(e, id)}
                  className="support-tab"
                  aria-current={activeSection === id ? 'true' : undefined}
                >
                  {tabLabels[id]}
                </a>
              ))}
            </nav>

            {/* ── How It Works ─────────────────────────────── */}
            <section
              id="about"
              ref={aboutRef as React.RefObject<HTMLElement>}
              className="mb-20"
            >
              <div style={enter(aboutVisible, 0)}>
                <h2 className="text-2xl font-bold text-white mb-8 section-heading" style={{ letterSpacing: '0.04em' }}>
                  How It Works
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    n: '01',
                    title: 'Find Your Spot',
                    body: 'Search for open mic venues across Delhi. Filter by time, location, spot type, and price. Get results that match exactly what you are looking for.',
                  },
                  {
                    n: '02',
                    title: 'Book Instantly',
                    body: 'Click on any venue card to see full show details including available spots, timings, and charges. Book your spot in seconds - no phone calls, no WhatsApp groups, no back and forth.',
                  },
                  {
                    n: '03',
                    title: 'Take the Stage',
                    body: 'Show up, sign in, and perform. Your booking is confirmed instantly and the venue knows you are coming. Focus on your set, not the logistics.',
                  },
                ].map(({ n, title, body }, i) => (
                  <div key={n} className="spotlight-card-wrap" style={enter(aboutVisible, 80 + i * 90)}>
                    <SpotlightCard className="rounded-2xl p-7 h-full">
                      <div
                        className="brand-openmic mb-5 select-none"
                        style={{ fontSize: '2.75rem', lineHeight: 1, color: 'rgba(56,189,248,0.3)' }}
                      >
                        {n}
                      </div>
                      <h3 className="text-base font-semibold text-white mb-3 leading-snug">{title}</h3>
                      <p className="text-zinc-400 text-sm leading-7">{body}</p>
                    </SpotlightCard>
                  </div>
                ))}
              </div>

              <div className="spotlight-card-wrap mt-6" style={enter(aboutVisible, 360)}>
                <SpotlightCard className="rounded-2xl p-7">
                  <h3 className="text-base font-semibold text-white mb-3 leading-snug">For Venue Producers</h3>
                  <p className="text-zinc-400 text-sm leading-7">
                    Register your venue on OPENMIC ~ Delhi and reach hundreds of comedians actively looking for
                    spots. Manage your shows, set spot availability, and track bookings - all from your venue
                    dashboard. New venues are reviewed and approved by our team before going live.
                  </p>
                </SpotlightCard>
              </div>
            </section>

            {/* ── Contact Us ───────────────────────────────── */}
            <section
              id="contact"
              ref={contactRef as React.RefObject<HTMLElement>}
              className="mb-20"
            >
              <div style={enter(contactVisible, 0)}>
                <h2 className="text-2xl font-bold text-white mb-8 section-heading" style={{ letterSpacing: '0.04em' }}>
                  Contact Us
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-5" aria-hidden="true">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    ),
                    title: 'General Inquiries',
                    email: 'hello@openmic.delhi',
                    desc: 'For general questions about the platform, partnerships, or press inquiries.',
                  },
                  {
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-5" aria-hidden="true">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    ),
                    title: 'Venue Support',
                    email: 'venues@openmic.delhi',
                    desc: 'For venue registration help, approval status, or dashboard issues. Our team responds within 24 hours.',
                  },
                ].map(({ icon, title, email, desc }, i) => (
                  <div key={email} className="spotlight-card-wrap" style={enter(contactVisible, 80 + i * 110)}>
                    <SpotlightCard className="rounded-2xl p-7 h-full">
                      {icon}
                      <h3 className="text-base font-semibold text-white mb-2 leading-snug">{title}</h3>
                      <a
                        href={`mailto:${email}`}
                        className="text-[#38bdf8] text-sm hover:underline inline-block"
                        style={{ minHeight: '44px', lineHeight: '44px' }}
                      >
                        {email}
                      </a>
                      <p className="text-zinc-400 text-sm leading-7 mt-1">{desc}</p>
                    </SpotlightCard>
                  </div>
                ))}
              </div>
            </section>

            {/* ── FAQ ──────────────────────────────────────── */}
            <section
              id="faq"
              ref={faqRef as React.RefObject<HTMLElement>}
              className="mb-20"
            >
              <div style={enter(faqVisible, 0)}>
                <h2 className="text-2xl font-bold text-white mb-8 section-heading" style={{ letterSpacing: '0.04em' }}>
                  Frequently Asked Questions
                </h2>
              </div>

              {FAQ_ITEMS.map(({ q, a }, i) => (
                <div key={q} className="spotlight-card-wrap" style={enter(faqVisible, 60 + i * 65)}>
                  <SpotlightCard className="rounded-xl px-6 py-5 mb-3">
                    <p className="text-sm font-semibold text-white mb-2 leading-snug">{q}</p>
                    <p className="text-sm text-zinc-400 leading-7">{a}</p>
                  </SpotlightCard>
                </div>
              ))}
            </section>

            {/* ── Back to home ─────────────────────────────── */}
            <div className="text-center pb-8">
              <button
                onClick={() => router.push('/home')}
                className="btn-sweep bg-[#38bdf8] text-black font-bold px-8 rounded-xl hover:bg-[#0ea5e9] transition-colors duration-150"
                style={{ minHeight: '44px' }}
              >
                Back to Home
              </button>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
