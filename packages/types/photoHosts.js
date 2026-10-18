// Where venue photos may be hosted, and the one validator for photo lists.
// Plain ESM (no TypeScript) so apps/web/next.config.js, which is plain Node,
// can import it as well as the API and the web app. Types are in photoHosts.d.ts.
//
// Why an allowlist: next/image throws on a host that is not in remotePatterns,
// and four public components render photos[0] with it, so one bad URL would
// break pages for every comedian. next.config.js builds its remotePatterns
// from PHOTO_HOSTS below, so the two cannot drift.

export const PHOTO_MAX_COUNT = 8;
export const PHOTO_URL_MAX_LENGTH = 2048;

export const PHOTO_HOSTS = [
  { hostname: 'picsum.photos' },
  { hostname: 'images.unsplash.com' },
  // Our Supabase Storage project, public objects only.
  { hostname: 'wfyqomxasthwdlpqttno.supabase.co', pathPrefix: '/storage/v1/object/public/' },
];

// Shape of next.config.js `images.remotePatterns`.
export function photoRemotePatterns() {
  return PHOTO_HOSTS.map((host) => ({
    protocol: 'https',
    hostname: host.hostname,
    ...(host.pathPrefix ? { pathname: `${host.pathPrefix}**` } : {}),
  }));
}

// Checks one URL. Returns an error message, or null when it is acceptable.
export function photoUrlError(url) {
  if (url.length > PHOTO_URL_MAX_LENGTH) {
    return `Each photo URL must be ${PHOTO_URL_MAX_LENGTH} characters or fewer`;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url.slice(0, 60)}" is not a valid URL`;
  }
  if (parsed.protocol !== 'https:') {
    return 'Photo URLs must start with https://';
  }
  if (parsed.username || parsed.password || parsed.port) {
    return 'Photo URLs cannot contain credentials or a port';
  }
  const host = PHOTO_HOSTS.find((h) => h.hostname === parsed.hostname);
  if (!host) {
    return `Photos must be hosted on: ${PHOTO_HOSTS.map((h) => h.hostname).join(', ')}`;
  }
  if (host.pathPrefix && !parsed.pathname.startsWith(host.pathPrefix)) {
    return `Photos on ${host.hostname} must be public storage files (${host.pathPrefix}...)`;
  }
  return null;
}

// Validates a whole photo list (the order is the display order; the first is
// the cover). Entries are trimmed. Returns { ok: true, photos } or
// { ok: false, error }. An empty list is valid (no photos).
export function validatePhotoUrls(value) {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'photos must be a list of URLs' };
  }
  if (value.length > PHOTO_MAX_COUNT) {
    return { ok: false, error: `At most ${PHOTO_MAX_COUNT} photos` };
  }
  const photos = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { ok: false, error: 'Each photo must be a non-empty URL' };
    }
    const url = entry.trim();
    const error = photoUrlError(url);
    if (error) return { ok: false, error };
    photos.push(url);
  }
  return { ok: true, photos };
}
