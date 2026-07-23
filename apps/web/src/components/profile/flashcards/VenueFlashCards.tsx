'use client';

import type { AuthUser } from '../../../lib/auth';
import { parseSocialHandle } from '../../../lib/socialHandle';
import { GmailIcon, InstagramIcon, MapsIcon, YouTubeIcon } from './BrandIcons';
import styles from './VenueFlashCards.module.css';
import { FlashCardStack } from './FlashCardStack';

interface VenueFlashCardsProps {
  user: AuthUser;
}

interface LinkedSocialCardProps {
  themeClassName?: string;
  icon: React.ReactNode;
  label: string;
  handle: string;
  href?: string;
}

function LinkedSocialCard({ themeClassName, icon, label, handle, href }: LinkedSocialCardProps) {
  const card = (
    <div className={`${styles.socialCard} ${themeClassName}`}>
      <span className={styles.socialIcon}>{icon}</span>
      <p className={styles.socialLabel}>{label}</p>
      <p className={styles.socialHandle}>{handle}</p>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.socialCardLink}
      aria-label={`${label} — ${handle}`}
    >
      {card}
    </a>
  );
}

export function VenueFlashCards({ user }: VenueFlashCardsProps) {
  const instagramHandle = parseSocialHandle(user.instagramUrl) ?? 'Not linked';
  const youtubeHandle = parseSocialHandle(user.youtubeUrl) ?? 'Not linked';
  const mapsHandle = user.mapsUrl ? 'View location' : 'Not linked';

  const center = (
    <div className={styles.centerCard}>
      <div className={styles.centerAvatar}>{(user.venueName ?? user.name).charAt(0).toUpperCase()}</div>
      <h2 className={styles.centerName}>{user.venueName ?? 'My Venue'}</h2>
      <div className={styles.centerDivider} />
      <p className={styles.centerBio}>
        {user.bio && user.bio.trim().length > 0 ? user.bio : 'No bio yet — add one from Edit Profile.'}
      </p>
    </div>
  );

  return (
    <FlashCardStack
      center={center}
      outerLeft={
        <LinkedSocialCard
          themeClassName={styles.instagram}
          icon={<InstagramIcon className={styles.iconSvg} />}
          label="Instagram"
          handle={instagramHandle}
          href={user.instagramUrl}
        />
      }
      innerLeft={
        <LinkedSocialCard
          themeClassName={styles.youtube}
          icon={<YouTubeIcon className={styles.iconSvg} />}
          label="YouTube"
          handle={youtubeHandle}
          href={user.youtubeUrl}
        />
      }
      innerRight={
        <LinkedSocialCard
          themeClassName={styles.maps}
          icon={<MapsIcon className={styles.iconSvg} />}
          label="Maps"
          handle={mapsHandle}
          href={user.mapsUrl}
        />
      }
      outerRight={
        <div className={`${styles.socialCard} ${styles.gmail}`} tabIndex={0}>
          <span className={styles.socialIcon}>
            <GmailIcon className={styles.iconSvg} />
          </span>
          <p className={styles.socialLabel}>Contact</p>
          <p className={styles.socialHandle}>{user.phone || 'No phone set'}</p>
          <p className={styles.socialSubtext}>{user.contactEmail || 'No contact email set'}</p>
        </div>
      }
    />
  );
}
