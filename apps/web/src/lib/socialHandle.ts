export function parseSocialHandle(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];

    if (!last) {
      return null;
    }

    return last.startsWith('@') ? last : `@${last}`;
  } catch {
    return null;
  }
}
