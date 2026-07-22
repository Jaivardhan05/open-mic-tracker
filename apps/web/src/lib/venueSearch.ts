export function matchesVenueSearch(
  venue: { name?: string | null; address?: string | null },
  query: string
): boolean {
  if (query === '') return true;
  const q = query.toLowerCase();
  const name = String(venue.name ?? '').toLowerCase();
  const address = String(venue.address ?? '').toLowerCase();
  return name.includes(q) || address.includes(q);
}
