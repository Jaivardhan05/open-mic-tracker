export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  photos: string[];
  description: string;
}

export interface Show {
  id: string;
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string;
  spot_type: 'busking' | 'non_busking';
  total_spots: number;
  available_spots: number;
  charge: number;
}
