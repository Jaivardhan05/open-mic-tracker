'use client';

import { useAuth } from '../../context/AuthContext';
import { VenueFlashCards } from './flashcards/VenueFlashCards';
import { ProfileHeader } from './ProfileHeader';

export function VenueOwnerProfile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <ProfileHeader user={user} />
      <VenueFlashCards user={user} />
    </div>
  );
}
