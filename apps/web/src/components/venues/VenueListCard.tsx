"use client";

import Image from 'next/image';
import Link from 'next/link';

import type { Show, Venue } from '@repo/types';

import { enter } from '../../hooks/useVisible';
import { IconChevronRight, IconMapPin } from '../icons/NavIcons';
import { SpotlightCard } from './SpotlightCard';

interface VenueListCardProps {
  venue: Venue;
  shows: Show[];
  index: number;
  visible: boolean;
}

export function VenueListCard({ venue, shows, index, visible }: VenueListCardProps) {
  const totalSpots = shows.reduce((sum, s) => sum + Number(s.available_spots ?? 0), 0);
  const lowAvailability = shows.some((s) => Number(s.available_spots ?? 0) <= 3);
  const hasFree = shows.some((s) => Number(s.charge ?? 0) === 0);
  const priceLabel = hasFree
    ? 'Free'
    : shows.length > 0
    ? `From ₹${Math.min(...shows.map((s) => Number(s.charge ?? 0)))}`
    : '—';

  const visibleShows = shows.slice(0, 3);
  const extraCount = shows.length - visibleShows.length;

  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group block spotlight-card-wrap"
      style={enter(visible, Math.min(index, 10) * 50)}
    >
      <SpotlightCard className="rounded-2xl overflow-hidden">
        <div className="relative aspect-video">
          <Image
            src={venue.photos?.[0] ?? `https://picsum.photos/seed/${venue.id}/600/400`}
            alt={venue.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            unoptimized
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 pointer-events-none" />

          {shows.length > 0 && (
            <span
              className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-md ${
                lowAvailability ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-white'
              }`}
            >
              {totalSpots} left
            </span>
          )}

          <span
            className={`absolute bottom-3 left-3 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold ${
              hasFree ? 'text-[#38bdf8]' : 'text-white'
            }`}
          >
            {priceLabel}
          </span>
        </div>

        <div className="p-4">
          <h3 className="font-bold text-white text-lg mb-1 line-clamp-1">{venue.name}</h3>

          <p className="flex items-center gap-1 text-zinc-500 text-xs mb-3 line-clamp-1">
            <IconMapPin className="w-3 h-3 shrink-0" />
            <span className="line-clamp-1">{venue.address}</span>
          </p>

          <div className="flex flex-wrap gap-1.5 mb-1">
            {visibleShows.map((show) => (
              <span
                key={show.id}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  show.spot_type === 'busking'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}
              >
                {String(show.start_time ?? '').slice(0, 5)}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-white/5 text-zinc-400">
                +{extraCount} more
              </span>
            )}
            {shows.length === 0 && <span className="text-xs text-zinc-600">No upcoming shows</span>}
          </div>

          <div className="flex items-center justify-end gap-1 mt-2 h-4 text-xs font-medium text-[#38bdf8] opacity-0 group-hover:opacity-100 transition-opacity">
            View details
            <IconChevronRight className="w-3 h-3" />
          </div>
        </div>
      </SpotlightCard>
    </Link>
  );
}
