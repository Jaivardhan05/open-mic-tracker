"use client";
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import BrandMark from './BrandMark';
import { useAuth } from '../context/AuthContext';
import { getDisplayFirstName } from '../lib/formatName';
import { IconHome, IconVenues, IconInfo, IconMail, IconClose, IconLogout, IconUser } from './icons/NavIcons';

const links = [
  { label: 'Home', href: '/home', icon: IconHome },
  { label: 'Venues', href: '/venues', icon: IconVenues },
  { label: 'About', href: '/support', icon: IconInfo },
  { label: 'Contact', href: '/support#contact', icon: IconMail },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleContactClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === '/support') {
      e.preventDefault();
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function isActive(link: (typeof links)[number]) {
    if (link.label === 'Contact') return false;
    return pathname === link.href.split('#')[0];
  }

  return (
    <>
      <nav
        className="navbar-glass fixed top-0 left-0 right-0 z-[60] h-14 flex items-center justify-between px-4 md:px-6 backdrop-blur-[40px] backdrop-saturate-[120%]"
      >
        <BrandMark variant="nav" />

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={link.label === 'Contact' ? handleContactClick : undefined}
                className={`text-sm motion-safe:transition-all motion-safe:duration-100 relative after:absolute after:bottom-[-2px] after:left-0 after:h-px after:bg-[#38bdf8] motion-safe:after:transition-all motion-safe:after:duration-150 hover:after:w-full ${
                  active ? 'text-white after:w-full' : 'text-zinc-400 hover:text-white after:w-0'
                }`}
              >
                {link.label}
              </a>
            );
          })}
          {user && (
            <div
              onClick={() => router.push('/profile')}
              className="hidden md:flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-9 h-9 rounded-full bg-[#38bdf8]/20 flex items-center justify-center text-white text-sm font-bold ring-2 ring-[#38bdf8]/55 ring-offset-2 ring-offset-black shadow-[0_0_10px_1px_rgba(56,189,248,0.25)] motion-safe:transition-all motion-safe:duration-75 motion-safe:ease-out motion-safe:group-active:scale-[0.97]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="brand-delhi text-base motion-safe:transition-colors motion-safe:duration-150 group-hover:text-[#7dd3fc]">
                {getDisplayFirstName(user.name)}
              </span>
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

      <div
        className={`mobile-menu-root md:hidden fixed inset-0 z-[70] flex justify-end ${
          isOpen ? '' : 'pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-200 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />

        <div
          className={`mobile-menu-glass relative w-[75%] max-w-sm h-full border-l border-white/10 flex flex-col p-6 pt-safe pb-safe shadow-2xl z-10 backdrop-blur-[40px] backdrop-saturate-[120%] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white text-xl font-light rounded-xl bg-zinc-800/40 border border-zinc-700/30 active:bg-zinc-700/50 motion-safe:transition-all motion-safe:duration-75 motion-safe:active:scale-[0.97]"
            aria-label="Close menu"
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>

          <BrandMark variant="nav" className="mb-8" />

          <div className="w-full h-px bg-zinc-700/40 mb-6" />

          {links.map((link) => {
            const active = isActive(link);
            const Icon = link.icon;
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  if (link.label === 'Contact') handleContactClick(e);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 py-4 px-2 text-base font-medium border-b border-zinc-700/20 motion-safe:transition-all motion-safe:duration-75 group ${
                  active ? 'text-[#38bdf8]' : 'text-zinc-300 hover:text-white active:text-[#38bdf8]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-[#38bdf8]' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                <span className="flex-1">{link.label}</span>
              </a>
            );
          })}

          {user && (
            <a
              href="/profile"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 py-4 px-2 text-base font-medium border-b border-zinc-700/20 motion-safe:transition-all motion-safe:duration-75 group ${
                pathname === '/profile' ? 'text-[#38bdf8]' : 'text-zinc-300 hover:text-white active:text-[#38bdf8]'
              }`}
            >
              <IconUser
                className={`h-4 w-4 shrink-0 ${
                  pathname === '/profile' ? 'text-[#38bdf8]' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              <span className="flex-1">My Profile</span>
            </a>
          )}

          <button
            onClick={() => {
              logout();
              router.push('/auth');
              setIsOpen(false);
            }}
            className="flex items-center gap-3 w-full text-left py-4 text-lg font-medium text-red-400 active:text-red-300 transition-colors duration-150 border-t border-zinc-700/50 mt-4"
          >
            <IconLogout className="h-4 w-4 shrink-0" />
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
    </>
  );
}
