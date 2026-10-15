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

export interface AdminVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  admin_approved: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
}

/** Stored on venues.review_status (migration 018). */
export type VenueReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

/**
 * The six statuses an admin sees at a glance: the review status plus the two
 * overlay flags. Each venue has exactly one: suspended wins; hidden is the
 * primary status only for an approved venue (a hidden venue that is still
 * pending/changes-requested/rejected keeps its review status so it never
 * drops out of the review queue); otherwise the review status.
 * See specs/admin-venue-management.md.
 */
export type VenueDisplayStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'hidden'
  | 'suspended';

/** Row of GET /api/admin/manage/venues. No address by design. */
export interface AdminManagedVenue {
  id: string;
  name: string;
  city: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  review_status: VenueReviewStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Response of GET /api/venues/mine/status: the owner's own venue state. */
export interface OwnerVenueStatus {
  id: string;
  name: string;
  city: string;
  description: string | null;
  review_status: VenueReviewStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  /** Approved, active and not suspended: may add shows and take requests. */
  can_operate: boolean;
  /** Pending or changes requested: name, city and description are editable. */
  can_edit_details: boolean;
  allowed_cities: string[];
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
  /** Set when the comedian is already accepted for another spot in the same show. */
  blocked_by_spot_type?: PoolType | null;
  requested_at: string;
  decided_at: string | null;
  spot?: Spot;
  venue_id?: string | null;
  venue_name?: string;
  comedian_name?: string;
}
