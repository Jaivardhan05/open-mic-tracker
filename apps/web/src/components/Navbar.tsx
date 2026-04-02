"use client";

import { useState } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = ["Home", "Venues", "About", "Contact"];

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-14 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="text-lg">
          <span className="font-bold text-white font-[family-name:var(--font-inter)]">
            OpenMic
          </span>{" "}
          <span className="italic text-[#F97316] font-[family-name:var(--font-playfair)]">
            Delhi
          </span>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className="relative text-sm text-zinc-400 transition-colors hover:text-white after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[#F97316] after:transition-all after:duration-300 hover:after:w-full"
            >
              {item}
            </a>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          className="lg:hidden flex flex-col justify-center items-center w-11 h-11 rounded-xl bg-transparent border-none cursor-pointer active:bg-zinc-800 transition-colors duration-150 -mr-2"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <div className="flex flex-col gap-[5px] pointer-events-none">
            <div className="w-5 h-0.5 bg-zinc-300 rounded" />
            <div className="w-5 h-0.5 bg-zinc-300 rounded" />
            <div className="w-5 h-0.5 bg-zinc-300 rounded" />
          </div>
        </button>
      </div>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />

          <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col pt-16 px-6">
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white text-2xl rounded-xl active:bg-zinc-800"
              aria-label="Close navigation menu"
            >
              ×
            </button>

            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className="block py-4 text-lg font-medium text-zinc-300 hover:text-white border-b border-zinc-800/50 active:text-[#F97316] transition-colors duration-150"
                onClick={() => setIsMenuOpen(false)}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
