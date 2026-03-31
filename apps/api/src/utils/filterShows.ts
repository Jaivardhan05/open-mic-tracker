import type { Show } from '@repo/types';

export interface ShowFilters {
  date?: string;
  spot_type?: 'busking' | 'non_busking';
  after_time?: string;
  before_time?: string;
  venue_ids?: string[];
}

export function filterShows(shows: Show[], filters: ShowFilters): Show[] {
  if (filters.venue_ids && filters.venue_ids.length === 0) {
    return [];
  }

  return shows.filter((show) => {
    if (filters.date && show.date !== filters.date) {
      return false;
    }

    if (filters.spot_type && show.spot_type !== filters.spot_type) {
      return false;
    }

    if (filters.after_time && show.start_time < filters.after_time) {
      return false;
    }

    if (filters.before_time && show.start_time > filters.before_time) {
      return false;
    }

    if (filters.venue_ids && !filters.venue_ids.includes(show.venue_id)) {
      return false;
    }

    return true;
  });
}
