"use client";
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const links = ['Home', 'Venues', 'About', 'Contact'];

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[60] h-14 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/50 flex items-center justify-between px-4 md:px-6"
      >
        <div className="flex items-center gap-0.5">
          <span className="font-bold text-white text-lg tracking-tight">OpenMic</span>
          <span className="italic text-[#F97316] text-lg font-serif ml-1">Delhi</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200 relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-[#F97316] after:transition-all after:duration-300 hover:after:w-full"
            >
              {link}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10 rounded-md active:bg-white/10 transition-colors z-[60]"
          aria-label="Open menu"
        >
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
          <span className="block w-6 h-0.5 bg-zinc-200 rounded-full" />
        </button>
      </nav>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[70] flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-[75%] max-w-sm h-full bg-zinc-950/70 backdrop-blur-2xl border-l border-white/10 flex flex-col p-6 shadow-2xl z-10">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white text-xl font-light rounded-xl bg-zinc-800/40 border border-zinc-700/30 active:bg-zinc-700/50 transition-colors duration-150"
              aria-label="Close menu"
            >
              ✕
            </button>

            <div className="mb-8 flex items-center gap-1">
              <span className="font-bold text-white text-xl tracking-tight">OpenMic</span>
              <span className="italic text-[#F97316] text-xl font-serif ml-1">Delhi</span>
            </div>

            <div className="w-full h-px bg-zinc-700/40 mb-6" />

            {links.map((link) => (
              <a
                key={link}
                href="#"
                onClick={() => setIsOpen(false)}
                className="flex items-center py-4 px-2 text-base font-medium text-zinc-300 hover:text-white active:text-[#F97316] border-b border-zinc-700/20 transition-colors duration-150 group"
              >
                <span className="flex-1">{link}</span>
                <span className="text-zinc-600 group-hover:text-zinc-400 group-active:text-[#F97316] text-sm transition-colors">
                  →
                </span>
              </a>
            ))}

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
