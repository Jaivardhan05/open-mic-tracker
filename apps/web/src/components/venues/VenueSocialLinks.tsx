'use client';

import type { ReactNode } from 'react';
import type { Venue } from '@repo/types';

import { IconInstagram, IconMail, IconMapPin, IconYoutube } from '../icons/NavIcons';

interface VenueSocialLinksProps {
  venue: Venue;
}

interface SocialEntry {
  key: string;
  href?: string;
  icon: ReactNode;
  label: string;
}

export function VenueSocialLinks({ venue }: VenueSocialLinksProps) {
  const entries: SocialEntry[] = [];

  const hasContact = Boolean(venue.contact_email || venue.contact_phone);
  if (hasContact) {
    entries.push({ key: 'contact', icon: <IconMail className="w-full h-full" />, label: 'Contact' });
  }
  if (venue.instagram_url) {
    entries.push({
      key: 'instagram',
      href: venue.instagram_url,
      icon: <IconInstagram className="w-full h-full" />,
      label: 'Instagram',
    });
  }
  if (venue.youtube_url) {
    entries.push({
      key: 'youtube',
      href: venue.youtube_url,
      icon: <IconYoutube className="w-full h-full" />,
      label: 'YouTube',
    });
  }
  if (venue.maps_url) {
    entries.push({
      key: 'maps',
      href: venue.maps_url,
      icon: <IconMapPin className="w-full h-full" />,
      label: 'Google Maps',
    });
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-white mb-4">Connect</h2>

      <style>{`
        .vsp-card {
          position: relative;
          width: 220px;
          height: 220px;
          border-radius: 30px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.52);
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(24px) saturate(120%);
          -webkit-backdrop-filter: blur(24px) saturate(120%);
          transition: transform 0.5s ease-in-out;
        }
        .vsp-card:hover {
          transform: scale(1.04);
        }
        .vsp-label {
          position: absolute;
          right: 50%;
          bottom: 50%;
          transform: translate(50%, 50%);
          transition: all 0.6s ease-in-out;
          font-size: 0.8rem;
          font-weight: 600;
          color: #38bdf8;
          letter-spacing: 3px;
          white-space: nowrap;
        }
        .vsp-card:hover .vsp-label {
          transform: translate(65px, -70px);
          letter-spacing: 1px;
        }
        .vsp-box {
          position: absolute;
          bottom: -100%;
          left: -100%;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-top: 1px solid rgba(255, 255, 255, 0.18);
          border-right: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10% 13% 42% 0% / 10% 12% 75% 0%;
          transform-origin: bottom left;
          transition: bottom 0.8s ease-in-out, left 0.8s ease-in-out, background-color 0.3s ease-in-out, border-color 0.3s ease-in-out;
        }
        .vsp-card:hover .vsp-box {
          bottom: -1px;
          left: -1px;
        }
        .vsp-box:hover {
          background: rgba(56, 189, 248, 0.16);
          border-color: rgba(56, 189, 248, 0.55);
        }
        .vsp-box1 { width: 70%; height: 70%; }
        .vsp-box2 { width: 50%; height: 50%; transition-delay: 0.15s; }
        .vsp-box3 { width: 32%; height: 32%; transition-delay: 0.3s; }
        .vsp-box4 { width: 18%; height: 18%; transition-delay: 0.45s; }
        .vsp-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          color: rgba(255, 255, 255, 0.8);
          transition: color 0.3s ease-in-out;
        }
        .vsp-box:hover .vsp-icon {
          color: #38bdf8;
        }
        .vsp-contact-text {
          font-size: 0.65rem;
          line-height: 1.3;
          color: #ffffff;
          text-align: right;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          margin-right: 6px;
        }
        .vsp-box:hover .vsp-contact-text {
          opacity: 1;
        }
      `}</style>

      <div className="vsp-card">
        <span className="vsp-label">Connect</span>
        {entries.map((entry, index) => {
          const boxClassName = `vsp-box vsp-box${index + 1}`;

          if (entry.key === 'contact') {
            return (
              <div key={entry.key} className={boxClassName} aria-label={entry.label}>
                <span className="vsp-contact-text">
                  {venue.contact_email ? <span className="block">{venue.contact_email}</span> : null}
                  {venue.contact_phone ? <span className="block">{venue.contact_phone}</span> : null}
                </span>
                <span className="vsp-icon">{entry.icon}</span>
              </div>
            );
          }

          return (
            <a
              key={entry.key}
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              className={boxClassName}
              aria-label={entry.label}
            >
              <span className="vsp-icon">{entry.icon}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
