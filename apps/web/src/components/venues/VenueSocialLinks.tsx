'use client';

import { useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { Venue } from '@repo/types';

import { GmailIcon, InstagramIcon, MapsIcon, XIcon } from '../profile/flashcards/BrandIcons';
import { parseSocialHandle } from '../../lib/socialHandle';
import styles from './VenueSocialLinks.module.css';

interface VenueSocialLinksProps {
  venue: Venue;
}

interface SocialItem {
  key: string;
  themeClass: string | undefined;
  label: string;
  icon: ReactNode;
  href?: string | null;
  detail: string;
  isContact?: boolean;
}

export function VenueSocialLinks({ venue }: VenueSocialLinksProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const items: SocialItem[] = [
    {
      key: 'x',
      themeClass: styles.x,
      label: 'X',
      icon: <XIcon className={styles.icon} />,
      href: venue.x_url ?? undefined,
      detail: venue.x_url ? (parseSocialHandle(venue.x_url) ?? 'View profile') : 'Not linked',
    },
    {
      key: 'instagram',
      themeClass: styles.instagram,
      label: 'Instagram',
      icon: <InstagramIcon className={styles.icon} />,
      href: venue.instagram_url ?? undefined,
      detail: venue.instagram_url ? (parseSocialHandle(venue.instagram_url) ?? 'View profile') : 'Not linked',
    },
    {
      key: 'maps',
      themeClass: styles.maps,
      label: 'Maps',
      icon: <MapsIcon className={styles.icon} />,
      href: venue.maps_url ?? undefined,
      detail: venue.maps_url ? 'View on Google Maps' : 'Not linked',
    },
    {
      key: 'contact',
      themeClass: styles.contact,
      label: 'Contact',
      icon: <GmailIcon className={styles.icon} />,
      detail:
        venue.contact_email || venue.contact_phone
          ? [venue.contact_email, venue.contact_phone].filter(Boolean).join('\n')
          : 'Not linked',
      isContact: true,
    },
  ];

  function activate(item: SocialItem, e: MouseEvent | KeyboardEvent) {
    if (item.isContact) {
      e.preventDefault();
      setExpandedKey((cur) => (cur === item.key ? null : item.key));
      return;
    }

    if (!item.href) {
      e.preventDefault();
      return;
    }

    if (expandedKey !== item.key) {
      e.preventDefault();
      setExpandedKey(item.key);
    }
  }

  function handleKeyDown(item: SocialItem, e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      activate(item, e);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-white mb-4">Connect</h2>

      <div className={styles.card}>
        {items.map((item) => {
          const isExpanded = expandedKey === item.key;
          const isDisabled = !item.isContact && !item.href;
          const className = [
            styles.item,
            item.themeClass,
            isExpanded ? styles.expanded : '',
            isDisabled ? styles.disabled : '',
          ]
            .filter(Boolean)
            .join(' ');

          const content = (
            <>
              {item.icon}
              {isExpanded ? (
                <span className={styles.detail} style={{ whiteSpace: 'pre-line' }}>
                  {item.detail}
                </span>
              ) : null}
            </>
          );

          if (item.isContact) {
            return (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                aria-expanded={isExpanded}
                className={className}
                onMouseEnter={() => setExpandedKey(item.key)}
                onMouseLeave={() => setExpandedKey((cur) => (cur === item.key ? null : cur))}
                onClick={(e) => activate(item, e)}
                onKeyDown={(e) => handleKeyDown(item, e)}
              >
                {content}
              </div>
            );
          }

          return (
            <a
              key={item.key}
              href={item.href ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              aria-expanded={isExpanded}
              aria-disabled={isDisabled}
              tabIndex={0}
              className={className}
              onMouseEnter={() => setExpandedKey(item.key)}
              onMouseLeave={() => setExpandedKey((cur) => (cur === item.key ? null : cur))}
              onClick={(e) => activate(item, e)}
              onKeyDown={(e) => handleKeyDown(item, e)}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
