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

  if (user.role === 'venue_producer') {
    navItems.push({
      label: 'My Venues',
      href: '/profile/venues',
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
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    });
  }

  if (user.role === 'admin') {
    navItems.push({
      label: 'Admin Controls',
      href: '/admin-dashboard',
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      <div className="flex pt-14">
        <aside className="hidden md:flex flex-col fixed left-0 top-14 bottom-0 w-56 bg-zinc-950 border-r border-zinc-800/50 pt-8 px-3 z-30">
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

          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 mb-1 ${
                pathname === item.href
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {item.icon}
              {item.label}
            </a>
          ))}

          <div className="mt-auto pt-4 border-t border-zinc-800/50">
            <button
              onClick={() => {
                void logout();
                router.push('/auth');
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 cursor-pointer transition-colors duration-200 hover:text-red-300 hover:bg-red-900/20 w-full"
            >
              Log Out
            </button>
          </div>
        </aside>

        <main className="flex-1 md:ml-56 px-4 md:px-8 py-8 min-h-screen">
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
