"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import Navbar from '../../../src/components/Navbar';
import { useAuth } from '../../../src/context/AuthContext';
import { supabase } from '../../../src/lib/supabaseClient';

export default function EditProfilePage() {
  const { user, isLoading, logout, updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [nameValue, setNameValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [cityValue, setCityValue] = useState('Delhi');
  const [venueNameValue, setVenueNameValue] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setNameValue(user.name ?? '');
    setUsernameValue(user.username ?? '');
    setCityValue(user.city ?? 'Delhi');
    setVenueNameValue(user.venueName ?? '');
  }, [user]);

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

  const currentUser = user;

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

  async function handlePasswordChange() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordError('Current password is incorrect');
      setPasswordLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setPasswordError(updateError.message);
    } else {
      setPasswordSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    }

    setPasswordLoading(false);
  }

  async function handleSaveProfile() {
    setSaveLoading(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: nameValue.trim(),
          city: cityValue,
        })
        .eq('id', currentUser.id);

      if (error) {
        setSaveError(error.message);
      } else {
        updateUser({
          name: nameValue.trim(),
          city: cityValue,
          username: usernameValue.trim(),
        });
        setSaveSuccess('Profile saved successfully');
      }
    } catch {
      setSaveError('Failed to save profile');
    } finally {
      setSaveLoading(false);
    }
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

          <div className="mx-auto w-full max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-8">Edit Profile</h1>

            <div className="rounded-3xl border border-zinc-800 bg-black/30 p-5 md:p-6">
              <div className="mb-8">
                <div className="w-20 h-20 rounded-full bg-[#F97316] text-white text-3xl font-bold flex items-center justify-center mx-auto mb-2">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => window.alert('Photo upload coming soon.')}
                  className="text-[#F97316] text-sm cursor-pointer text-center w-full"
                >
                  Change Photo
                </button>
              </div>

              <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="name-value">
                Full Name
              </label>
              <input
                id="name-value"
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
              />

              <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="username-value">
                Username
              </label>
              <input
                id="username-value"
                type="text"
                value={usernameValue}
                onChange={(e) => setUsernameValue(e.target.value)}
                placeholder="@yourname"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
              />

              <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="city-value">
                City
              </label>
              <select
                id="city-value"
                value={cityValue}
                onChange={(e) => setCityValue(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
              >
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Pune">Pune</option>
              </select>

              {user.role === 'venue_producer' && (
                <>
                  <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="venue-name-value">
                    Venue Name
                  </label>
                  <input
                    id="venue-name-value"
                    type="text"
                    value={venueNameValue}
                    onChange={(e) => setVenueNameValue(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
                  />
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(!isChangingPassword);
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors duration-200 mb-4 min-h-[44px]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-400"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-auto transition-transform duration-200 ${isChangingPassword ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isChangingPassword && (
                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                  {passwordError ? (
                    <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-3">
                      {passwordError}
                    </div>
                  ) : null}

                  {passwordSuccess ? (
                    <div className="bg-green-900/30 border border-green-800 text-green-400 text-sm rounded-xl px-4 py-3 mb-3">
                      {passwordSuccess}
                    </div>
                  ) : null}

                  <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="current-password">
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
                  />

                  <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="new-password">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
                  />

                  <label className="text-xs text-zinc-400 mb-1.5 font-medium block" htmlFor="confirm-password">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-base placeholder-zinc-500 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] mb-4 min-h-[44px]"
                  />

                  <button
                    type="button"
                    onClick={() => void handlePasswordChange()}
                    disabled={passwordLoading}
                    className="w-full bg-zinc-700 text-white font-semibold py-3 rounded-xl text-sm hover:bg-zinc-600 disabled:opacity-50 transition-colors duration-200 min-h-[44px] mt-2"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              )}

              {saveError ? (
                <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-3 mt-6">
                  {saveError}
                </div>
              ) : null}

              {saveSuccess ? (
                <div className="bg-green-900/30 border border-green-800 text-green-400 text-sm rounded-xl px-4 py-3 mb-3 mt-6">
                  {saveSuccess}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={saveLoading}
                className="w-full bg-[#F97316] text-white font-bold py-3 rounded-xl hover:bg-[#EA6C00] disabled:opacity-50 transition-colors duration-200 mt-6 min-h-[44px]"
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
