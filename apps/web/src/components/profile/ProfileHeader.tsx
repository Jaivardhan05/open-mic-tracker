import type { AuthUser } from '../../lib/auth';
import { IconMapPin } from '../icons/NavIcons';

interface ProfileHeaderProps {
  user: AuthUser;
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  comedian: 'Comedian',
  venue_producer: 'Venue Producer',
  admin: 'Admin',
};

function formatJoinedDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const joined = formatJoinedDate(user.createdAt);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#38bdf8]/20 text-3xl font-bold text-white ring-2 ring-[#38bdf8]/55 ring-offset-2 ring-offset-black shadow-[0_0_14px_2px_rgba(56,189,248,0.25)]">
        {user.name.charAt(0).toUpperCase()}
      </div>

      <h1 className="mt-4 text-2xl font-bold text-white">{user.name}</h1>

      <span className="mt-2 rounded-full bg-[#38bdf8]/20 px-3 py-1 text-center text-xs font-medium text-[#38bdf8]">
        {ROLE_LABEL[user.role]}
      </span>

      <p className="brand-delhi mt-2 flex items-center gap-1.5 text-sm" style={{ color: '#38bdf8' }}>
        <IconMapPin className="h-3.5 w-3.5 shrink-0" />
        {user.city}
      </p>

      {joined && <p className="mt-1 text-xs text-zinc-600">Joined {joined}</p>}
    </div>
  );
}
