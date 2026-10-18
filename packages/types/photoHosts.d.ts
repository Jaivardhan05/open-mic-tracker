export const PHOTO_MAX_COUNT: number;
export const PHOTO_URL_MAX_LENGTH: number;
export const PHOTO_HOSTS: ReadonlyArray<{ hostname: string; pathPrefix?: string }>;

export function photoRemotePatterns(): Array<{ protocol: 'https'; hostname: string; pathname?: string }>;

/** An error message for one URL, or null when it is acceptable. */
export function photoUrlError(url: string): string | null;

export function validatePhotoUrls(
  value: unknown
): { ok: true; photos: string[] } | { ok: false; error: string };
