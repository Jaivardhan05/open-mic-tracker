"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  onFilter: (query: string) => void;
}

export default function Sidebar({ onFilter }: SidebarProps) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-56 flex-col border-r border-zinc-800/50 bg-zinc-950 px-3 pt-6 lg:flex">
      <div className="space-y-1">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-zinc-800/60 px-3 py-3 text-left text-sm text-white transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => onFilter("")}
        >
          <span className="text-base">⌂</span>
          <span>Home</span>
        </button>

        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => onFilter("")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M7.333 2.667 2.667 8l4.666 5.333"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.667 2.667 13.333 8l-4.666 5.333"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Discover</span>
        </button>
      </div>

      <p className="mb-2 mt-6 px-3 text-xs font-semibold tracking-widest text-zinc-600">
        EXPLORE
      </p>
      <div className="space-y-1">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => router.push('/venues')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="2.5"
              y="2.5"
              width="11"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>All Venues</span>
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => onFilter("spots tonight")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 2.5v5.5l3.5 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>Tonight</span>
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => onFilter("free spots")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3 8h10M8 3v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>Free Spots</span>
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => onFilter("busking spots")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5.5 9.5c.5.6 1.2 1 2.5 1 1.3 0 2-.4 2.5-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>Busking</span>
        </button>
      </div>

      <p className="mb-2 mt-6 px-3 text-xs font-semibold tracking-widest text-zinc-600">
        SUPPORT
      </p>
      <div className="space-y-1">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => router.push('/support')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 12.667A4.667 4.667 0 1 0 8 3.333a4.667 4.667 0 0 0 0 9.334Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M8 6.5v2.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="10.833" r="0.667" fill="currentColor" />
          </svg>
          <span>How It Works</span>
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-white"
          onClick={() => router.push('/support#contact')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="2.5"
              y="3"
              width="11"
              height="10"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m3 4 5 4 5-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Contact Us</span>
        </button>
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-800/50">
        <button
          onClick={() => {
            logout();
            router.push('/auth');
          }}
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 cursor-pointer transition-colors duration-200 hover:text-red-300 hover:bg-red-900/20 w-full"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
