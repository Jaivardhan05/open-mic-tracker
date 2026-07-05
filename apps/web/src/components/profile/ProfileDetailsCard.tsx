import Link from 'next/link';

import type { AuthUser } from '../../lib/auth';
import { IconAt, IconChevronRight, IconMail, IconMapPin, IconPhone } from '../icons/NavIcons';

interface ProfileDetailsCardProps {
  user: AuthUser;
}

interface DetailRow {
  label: string;
  value: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

export function ProfileDetailsCard({ user }: ProfileDetailsCardProps) {
  const rows: DetailRow[] = [
    { label: 'Username', value: user.username ?? 'Not set', icon: IconAt },
    { label: 'Email', value: user.email, icon: IconMail },
    { label: 'Phone', value: user.phone || 'Not set', icon: IconPhone },
    { label: 'City', value: user.city, icon: IconMapPin },
  ];

  return (
    <section className="rounded-3xl border border-zinc-800 bg-black/30 p-4 md:p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Account Details</h2>

      <div className="divide-y divide-zinc-800/70">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">{row.label}</p>
                <p className="truncate text-sm font-medium text-white">{row.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/profile/edit"
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border-t border-zinc-800 pt-4 text-sm font-medium text-[#38bdf8] transition-colors hover:text-[#7dd3fc]"
      >
        Edit Profile
        <IconChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
