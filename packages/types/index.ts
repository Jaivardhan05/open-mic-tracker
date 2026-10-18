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

/**
 * Response of GET /api/admin/manage/venues/:id (Page B). No address by design.
 * hidden_at / hidden_by_name are null for venues hidden before migration 026.
 */
export interface AdminVenueDetail {
  id: string;
  name: string;
  city: string;
  description: string | null;
  photos: string[];
  instagram_url: string | null;
  x_url: string | null;
  maps_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  review_status: VenueReviewStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  submitted_at: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  hidden_by_name: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  suspended_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** Cities the edit form offers (a venue's own city is always accepted unchanged). */
  allowed_cities: string[];
}

/** Response of GET /api/admin/manage/venues. */
export interface AdminVenueListResponse {
  /** Venues matching q, status and city, oldest submission first. */
  venues: AdminManagedVenue[];
  /** Per display status, over the venues matching q and city (status ignored). `all` is their sum. */
  counts: Record<'all' | VenueDisplayStatus, number>;
  /** Distinct cities across every venue, sorted; not narrowed by any filter. */
  cities: string[];
}

/**
 * The single definition of a venue's display status, used by apps/api (to
 * filter and count) and apps/web (to render). Suspended wins; hidden is the
 * primary status only for an approved venue; otherwise the review status.
 *
 * This is the one runtime export of @repo/types, so it lives in index.ts
 * itself: a re-export from a sibling file is not visible to Node's ESM loader
 * when the API imports this CommonJS-typed package. Next needs
 * `transpilePackages: ['@repo/types']` (apps/web/next.config.js) to compile it.
 */
export function deriveDisplayStatus(venue: {
  review_status: VenueReviewStatus;
  is_hidden: boolean;
  is_suspended: boolean;
}): VenueDisplayStatus {
  if (venue.is_suspended) return 'suspended';
  if (venue.review_status === 'approved' && venue.is_hidden) return 'hidden';
  return venue.review_status;
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
