"use client";
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import BrandMark from './BrandMark';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = ['Home', 'Venues', 'About', 'Contact'];

  function handleContactClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === '/support') {
      e.preventDefault();
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <>
      <nav
        className="navbar-glass fixed top-0 left-0 right-0 z-[60] h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-[40px] backdrop-saturate-[120%]"
      >
        <BrandMark variant="nav" />

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link}
              href={
                link === 'Home'
                  ? '/home'
                  : link === 'Venues'
                  ? '/venues'
                  : link === 'About'
                  ? '/support'
                  : '/support#contact'
              }
              onClick={link === 'Contact' ? handleContactClick : undefined}
              className="text-sm text-zinc-400 hover:text-white motion-safe:transition-all motion-safe:duration-100 relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#38bdf8] motion-safe:after:transition-all motion-safe:after:duration-150 hover:after:w-full"
            >
              {link}
            </a>
          ))}
          {user && (
            <div className="hidden md:flex items-center gap-3">
              <div
                onClick={() => router.push('/profile')}
                className="w-9 h-9 rounded-full bg-[#38bdf8] flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:bg-[#0ea5e9] motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:active:scale-[0.97] select-none"
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-zinc-400 font-medium">{user.name.split(' ')[0]}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10 rounded-md active:bg-white/10 motion-safe:transition-all motion-safe:duration-75 motion-safe:active:scale-[0.97] z-[60]"
          aria-label="Open menu"
        >
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
        </button>
      </nav>

      {isOpen && (
        <div className="mobile-menu-root md:hidden fixed inset-0 z-[70] flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="mobile-menu-glass relative w-[75%] max-w-sm h-full border-l border-white/10 flex flex-col p-6 shadow-2xl z-10 backdrop-blur-[40px] backdrop-saturate-[120%]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white text-xl font-light rounded-xl bg-zinc-800/40 border border-zinc-700/30 active:bg-zinc-700/50 motion-safe:transition-all motion-safe:duration-75 motion-safe:active:scale-[0.97]"
              aria-label="Close menu"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <BrandMark variant="nav" className="mb-8" />

            <div className="w-full h-px bg-zinc-700/40 mb-6" />

            {links.map((link) => (
              <a
                key={link}
                href={
                  link === 'Home'
                    ? '/home'
                    : link === 'Venues'
                    ? '/venues'
                    : link === 'About'
                    ? '/support'
                    : '/support#contact'
                }
                onClick={(e) => {
                  if (link === 'Contact') handleContactClick(e);
                  setIsOpen(false);
                }}
                className="flex items-center py-4 px-2 text-base font-medium text-zinc-300 hover:text-white active:text-[#38bdf8] border-b border-zinc-700/20 motion-safe:transition-all motion-safe:duration-75 group"
              >
                <span className="flex-1">{link}</span>
                <span className="text-zinc-600 group-hover:text-zinc-400 group-active:text-[#38bdf8] text-sm motion-safe:transition-colors">
                  →
                </span>
              </a>
            ))}

            <button
              onClick={() => {
                logout();
                router.push('/auth');
                setIsOpen(false);
              }}
              className="block w-full text-left py-4 text-lg font-medium text-red-400 active:text-red-300 transition-colors duration-150 border-t border-zinc-700/50 mt-4"
            >
              Log Out
            </button>

            <div className="mt-auto pt-6 border-t border-zinc-700/30">
              <p className="text-xs text-zinc-600 leading-relaxed">
                Find your next open mic spot
                in Delhi.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
