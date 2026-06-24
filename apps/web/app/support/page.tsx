"use client";

import { useRouter } from 'next/navigation';

import Navbar from '../../src/components/Navbar';

export default function SupportPage() {
  const router = useRouter();

  return (
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
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-white mb-4">Support</h1>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Everything you need to know about OPENMIC ~ Delhi.
            </p>
          </div>

          <section id="how-it-works" className="mb-20">
            <h2 className="text-2xl font-bold text-white mb-8">How It Works</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="content-glass rounded-2xl p-6">
                <div className="text-4xl font-bold text-[#38bdf8]/30 mb-4">01</div>
                <h3 className="text-lg font-semibold text-white mb-2">Find Your Spot</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Search for open mic venues across Delhi using our AI-powered chatbot. Filter by time,
                  location, spot type, and price. Get results that match exactly what you are looking for.
                </p>
              </div>

              <div className="content-glass rounded-2xl p-6">
                <div className="text-4xl font-bold text-[#38bdf8]/30 mb-4">02</div>
                <h3 className="text-lg font-semibold text-white mb-2">Book Instantly</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Click on any venue card to see full show details including available spots, timings, and
                  charges. Book your spot in seconds - no phone calls, no WhatsApp groups, no back and
                  forth.
                </p>
              </div>

              <div className="content-glass rounded-2xl p-6">
                <div className="text-4xl font-bold text-[#38bdf8]/30 mb-4">03</div>
                <h3 className="text-lg font-semibold text-white mb-2">Take the Stage</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Show up, sign in, and perform. Your booking is confirmed instantly and the venue knows
                  you are coming. Focus on your set, not the logistics.
                </p>
              </div>
            </div>

            <div className="content-glass mt-12 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">For Venue Producers</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Register your venue on OPENMIC ~ Delhi and reach hundreds of comedians actively looking for
                spots. Manage your shows, set spot availability, and track bookings - all from your venue
                dashboard. New venues are reviewed and approved by our team before going live.
              </p>
            </div>
          </section>

          <section id="contact" className="mb-20">
            <h2 className="text-2xl font-bold text-white mb-8">Contact Us</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="content-glass rounded-2xl p-6">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-4"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>

                <h3 className="text-base font-semibold text-white mb-2">General Inquiries</h3>

                <a href="mailto:hello@openmic.delhi" className="text-[#38bdf8] text-sm hover:underline">
                  hello@openmic.delhi
                </a>

                <p className="text-zinc-500 text-sm mt-2">
                  For general questions about the platform, partnerships, or press inquiries.
                </p>
              </div>

              <div className="content-glass rounded-2xl p-6">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-4"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>

                <h3 className="text-base font-semibold text-white mb-2">Venue Support</h3>

                <a href="mailto:venues@openmic.delhi" className="text-[#38bdf8] text-sm hover:underline">
                  venues@openmic.delhi
                </a>

                <p className="text-zinc-500 text-sm mt-2">
                  For venue registration help, approval status, or dashboard issues. Our team responds
                  within 24 hours.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-20">
            <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>

            <div className="content-glass rounded-xl p-5 mb-3">
              <p className="text-sm font-semibold text-white mb-2">Is it free to sign up?</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Yes. Creating a comedian account on OPENMIC ~ Delhi is completely free. Some shows may have
                a spot charge set by the venue, which is shown clearly on the booking page before you
                confirm.
              </p>
            </div>

            <div className="content-glass rounded-xl p-5 mb-3">
              <p className="text-sm font-semibold text-white mb-2">How do I register my venue?</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Click Sign Up on the login page and select Venue Producer. Fill in your venue name and
                contact details. Our team will review your application and approve it within 48 hours.
                Once approved, you can add shows and manage bookings from your venue dashboard.
              </p>
            </div>

            <div className="content-glass rounded-xl p-5 mb-3">
              <p className="text-sm font-semibold text-white mb-2">What is a busking spot?</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A busking spot means you perform and earn directly from audience tips - there is no fixed
                charge. A non-busking spot is a structured slot with a fixed fee set by the venue.
              </p>
            </div>

            <div className="content-glass rounded-xl p-5 mb-3">
              <p className="text-sm font-semibold text-white mb-2">Can I cancel a booking?</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Cancellation policies vary by venue. Please contact the venue directly if you need to
                cancel. Refund support is coming soon.
              </p>
            </div>

            <div className="content-glass rounded-xl p-5 mb-3">
              <p className="text-sm font-semibold text-white mb-2">Which cities are supported?</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                OPENMIC ~ Delhi currently covers venues across Delhi NCR. Mumbai, Bangalore, and Pune are
                planned for future expansion.
              </p>
            </div>
          </section>

          <div className="text-center pb-8">
            <button
              onClick={() => router.push('/home')}
              className="bg-[#38bdf8] text-black font-bold px-8 py-3 rounded-xl hover:bg-[#0ea5e9] motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97]"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
