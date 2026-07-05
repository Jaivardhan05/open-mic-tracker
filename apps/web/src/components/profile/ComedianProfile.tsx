'use client';

import { useAuth } from '../../context/AuthContext';
import { ProfileDetailsCard } from './ProfileDetailsCard';
import { ProfileHeader } from './ProfileHeader';

export function ComedianProfile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <ProfileHeader user={user} />
      <ProfileDetailsCard user={user} />
    </div>
  );
}
