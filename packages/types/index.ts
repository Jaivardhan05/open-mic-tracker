export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  photos: string[];
  description: string;
  instagram_url?: string | null;
  x_url?: string | null;
  maps_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
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

export type BookingStatus =
  | 'awaiting_confirmation'
  | 'confirmed_awaiting_comedian'
  | 'confirmed_paid'
  | 'declined_by_comedian'
  | 'cancelled_by_comedian';

export type PaymentStatus = 'pending' | 'confirmed' | 'refunded' | 'failed';

export interface Booking {
  id: string;
  comedian_id: string;
  show_id: string;
  slots_booked: number;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  booked_at: string;
  show: Show;
  venue: Venue;
}

export interface FavoriteVenue extends Venue {
  booking_count: number;
}

export interface AdminVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  admin_approved: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
}

export interface VenueNotice {
  id: string;
  venue_id: string | null;
  venue_name: string;
  reason: string;
  created_at: string;
}

export type SpotRequestStatus =
  | 'pending'
  | 'accepted'
  | 'waitlisted'
  | 'cancelled_by_comedian'
  | 'cancelled_by_venue';

export type PoolType = 'busking' | 'non_busking' | 'hosting';

export interface Spot {
  id: string;
  venue_producer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  spot_type: PoolType;
  total_spots: number;
  available_spots: number;
  price: number | null;
  is_cancelled: boolean;
  cancellation_message: string | null;
  created_at: string;
}

// A Show has many Spots: up to one pool row per type (busking/non_busking/
// hosting). `null` means that pool has no active spots. See
// specs/venue-dashboard.md §9. Named VenueShow (not Show) because `Show`
// above is the unrelated legacy comedian-facing entity.
export interface VenueShow {
  id: string;
  venue_producer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_cancelled: boolean;
  cancellation_message: string | null;
  created_at: string;
  busking: Spot | null;
  non_busking: Spot | null;
  hosting: Spot | null;
}

export interface SpotRequest {
  id: string;
  spot_id: string;
  comedian_id: string;
  status: SpotRequestStatus;
  venue_message: string | null;
  edit_notice?: string | null;
  edit_notice_at?: string | null;
  requested_at: string;
  decided_at: string | null;
  spot?: Spot;
  venue_id?: string | null;
  venue_name?: string;
  comedian_name?: string;
}
