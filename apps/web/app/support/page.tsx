"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../src/components/Navbar';
import { SpotlightCard } from '../../src/components/venues/SpotlightCard';
import { useVisible, enter } from '../../src/hooks/useVisible';

// ─────────────────────────────────────────────────────────────────────────────

const SECTION_IDS = ['about', 'contact', 'faq'] as const;
type SectionId = (typeof SECTION_IDS)[number];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
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

        /* SpotlightCard hover border brightening via CSS (complement to the JS spotlight) */
        .spotlight-card-wrap:hover .content-glass {
          border-color: rgba(255, 255, 255, 0.26);
          transition: border-color 0.3s ease;
        }

        /* Stronger glassmorphism blur on this page's content cards only */
        .content-glass {
          backdrop-filter: blur(40px) saturate(120%);
          -webkit-backdrop-filter: blur(40px) saturate(120%);
        }
      `}</style>

      <div
        className="layout-root"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.30)),url("/mic-dark.png")',
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
              ref={aboutRef}
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
              ref={contactRef}
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
              ref={faqRef}
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
