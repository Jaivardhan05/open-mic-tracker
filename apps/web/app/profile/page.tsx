'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Navbar from '@/components/Navbar';
import { AdminProfile } from '@/components/profile/AdminProfile';
import { ComedianProfile } from '@/components/profile/ComedianProfile';
import { VenueOwnerProfile } from '@/components/profile/VenueOwnerProfile';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-4xl text-sm text-zinc-500">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const navItems: Array<{ label: string; href: string; icon: ReactNode }> = [
    {
      label: 'My Profile',
      href: '/profile',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Edit Profile',
      href: '/profile/edit',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="layout-root">
      <Navbar />

      <div className="flex">
        <aside className="sidebar-glass hidden md:flex flex-col fixed left-0 top-14 bottom-0 w-56 pt-8 px-3 z-30 backdrop-blur-[40px] backdrop-saturate-[120%]">
          <button
            onClick={() => router.push('/home')}
            className="flex items-center gap-2 px-3 py-2 mb-6 text-zinc-500 hover:text-white text-sm transition-colors duration-200 group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:-translate-x-1 transition-transform duration-200"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>

          <div className="w-full h-px bg-zinc-800/50 mb-6" />

          <div className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] ${
                    active
                      ? 'bg-[#38bdf8]/10 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#38bdf8]" />
                  )}
                  <span className={active ? 'text-[#38bdf8]' : ''}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-zinc-800/50">
            <button
              type="button"
              onClick={() => {
                void logout();
                router.push('/auth');
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-400 motion-safe:transition-all motion-safe:duration-150 motion-safe:active:scale-[0.97] hover:bg-red-900/20 hover:text-red-300"
            >
              Log Out
            </button>
          </div>
        </aside>

        <main
          className="main-content-glass sidebar-content-margin md:ml-56 px-4 md:px-8 py-8 overflow-y-auto w-full"
          style={{ height: 'calc(100dvh - 3.5rem)', marginTop: '3.5rem' }}
        >
          <div className="md:hidden mb-6">
            <button
              onClick={() => router.push('/home')}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>
          </div>

          {user.role === 'comedian' && <ComedianProfile />}
          {user.role === 'venue_producer' && <VenueOwnerProfile />}
          {user.role === 'admin' && <AdminProfile />}
        </main>
      </div>
    </div>
  );
}
