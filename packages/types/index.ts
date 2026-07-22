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

export type SpotRequestStatus =
  | 'pending'
  | 'accepted'
  | 'waitlisted'
  | 'cancelled_by_comedian'
  | 'cancelled_by_venue';

export interface Spot {
  id: string;
  venue_producer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  spot_type: 'busking' | 'non_busking';
  total_spots: number;
  available_spots: number;
  price: number | null;
  is_cancelled: boolean;
  cancellation_message: string | null;
  created_at: string;
}

export interface SpotRequest {
  id: string;
  spot_id: string;
  comedian_id: string;
  status: SpotRequestStatus;
  venue_message: string | null;
  requested_at: string;
  decided_at: string | null;
  spot?: Spot;
  venue_name?: string;
  comedian_name?: string;
}
