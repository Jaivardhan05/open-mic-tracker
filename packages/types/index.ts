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
  /** Whole hours (0 to 12) before a show starts up to which an accepted spot may be cancelled. Only on GET /api/venues/:id. */
  cancel_cutoff_hours?: number;
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
  /** Hours before a show starts up to which a comedian may cancel an accepted spot (0 to 12, migration 029). Read-only here. */
  cancel_cutoff_hours: number;
  /** Cities the edit form offers (a venue's own city is always accepted unchanged). */
  allowed_cities: string[];
}

/**
 * Response of GET /api/admin/manage/venues/:id/stats (all-time, migration 028).
 * `shows` counts venue_shows (a show has up to 3 spot pools); `requests` are
 * spot requests. `acceptance.excluded` and the "after acceptance" split follow
 * the migration 019 rules: requests cancelled before tracking began are
 * excluded, not guessed. Cancellations by venue include suspension-caused ones.
 */
export interface AdminVenueStats {
  success: true;
  has_owner: boolean;
  shows: { created: number; cancelled: number };
  requests: {
    total: number;
    pending: number;
    accepted: number;
    waitlisted: number;
    cancelled_by_comedian: number;
    cancelled_by_venue: number;
  };
  acceptance: { knowable: number; ever_accepted: number; excluded: number };
  cancelled_after_acceptance: { by_venue: number; by_comedian: number };
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
  /** Whole hours (0 to 12) before a show starts up to which a comedian may cancel an accepted spot. Copied onto each request at accept. */
  cancel_cutoff_hours: number;
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
  /**
   * Terms locked when the request was accepted (migration 029); null for every
   * other status. Price is in paise (0 = free; null on an accepted request =
   * invalid price, not billed). Only on GET /api/spot-requests/mine.
   */
  price_paise_at_accept?: number | null;
  cancel_cutoff_hours_at_accept?: number | null;
  /** ISO instant after which the comedian can no longer cancel this accepted spot; null unless accepted. */
  cancel_by?: string | null;
  /** The venue's cutoff right now: what would be locked if this request were accepted today. */
  venue_cancel_cutoff_hours?: number | null;
  spot?: Spot;
  venue_id?: string | null;
  venue_name?: string;
  comedian_name?: string;
}

// ---------------------------------------------------------------------------
// Billing (migration 030). TYPES ONLY: this package has exactly one runtime
// export for the API (deriveDisplayStatus) and must not gain another here.
// All money is integer paise; timestamps are ISO strings. These mirror the
// database rows; later steps decide which fields each API route returns.
// ---------------------------------------------------------------------------

export type BillStatus = 'draft' | 'sent' | 'paid' | 'paid_offline' | 'waived' | 'void' | 'refunded';

/** Which Razorpay mode a bill, payment or event belongs to. */
export type BillingMode = 'test' | 'live';

export type DuesPolicy = 'lenient' | 'strict';

export type BillPaymentMode = 'online' | 'offline';

export type BillDisputeOutcome = 'rejected' | 'reissued' | 'waived';

export type PaymentAttemptStatus = 'created' | 'captured' | 'expired' | 'cancelled';

export type PaymentReconcileFlag = 'bill_not_payable' | 'duplicate_payment' | 'amount_mismatch';

export type BillingAuditAction =
  | 'payment_captured'
  | 'payment_refunded'
  | 'payment_flagged'
  | 'bill_cleared_offline'
  | 'bill_waived'
  | 'bill_reopened'
  | 'bill_voided';

export type BillingActorRole = 'comedian' | 'owner' | 'admin' | 'system' | 'razorpay';

export type WebhookEventStatus = 'received' | 'processed' | 'failed' | 'ignored';

/** `billing_settings`: the single row of global defaults (admin only). */
export interface BillingSettings {
  billing_enabled: boolean;
  billing_start_date: string | null;
  dues_policy_default: DuesPolicy;
  due_days: number;
  commission_bps: number;
  fee_share_bps: number;
  auto_send_after_hours: number;
  max_spot_price_paise: number;
  auto_send_cap_paise: number;
  min_online_amount_paise: number;
  dispute_pause_days: number;
  reminder_max: number;
  webhook_payload_retention_days: number;
  notification_retention_days: number;
  /** null = never archive. */
  audit_archive_after_months: number | null;
  updated_by: string | null;
  updated_at: string;
}

/** `venue_billing_settings`: per-venue switches. A venue has no row until an admin creates one. */
export interface VenueBillingSettings {
  venue_id: string;
  enabled: boolean;
  /** Owner's choice ('strict' = switch on, 'lenient' = off); null = inherit the global default. */
  dues_policy: DuesPolicy | null;
  /** Set = locked; the owner sees it read-only. */
  dues_policy_admin_override: DuesPolicy | null;
  auto_send: boolean;
  due_days: number | null;
  commission_bps_override: number | null;
  /** Pay-button eligibility while Route is not used. */
  online_payments_enabled: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface Bill {
  id: string;
  /** Human reference like "B-000123"; not an invoice number. */
  bill_number: string;
  venue_id: string;
  venue_owner_id: string;
  comedian_id: string;
  venue_name: string;
  comedian_name: string;
  /** The Monday (IST) of the billing week, as YYYY-MM-DD. */
  week_start: string;
  status: BillStatus;
  mode: BillingMode;
  amount_due_paise: number;
  /** Frozen when the bill is sent; zero while a draft. */
  commission_bps: number;
  fee_share_bps: number;
  commission_paise: number;
  fee_share_paise: number;
  venue_net_paise: number;
  payment_mode: BillPaymentMode | null;
  due_at: string | null;
  generated_at: string;
  auto_send_at: string | null;
  sent_at: string | null;
  /** null on a sent bill = sent by the system (auto-send). */
  sent_by: string | null;
  paid_at: string | null;
  cleared_at: string | null;
  cleared_by: string | null;
  clear_reason: string | null;
  clear_reference: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  supersedes_bill_id: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  dispute_resolved_at: string | null;
  dispute_outcome: BillDisputeOutcome | null;
  last_reminded_at: string | null;
  reminder_count: number;
  /** A line's request or show changed after the line was created. */
  needs_review: boolean;
  is_demo: boolean;
  updated_at: string;
}

export interface BillLine {
  id: string;
  bill_id: string;
  request_id: string;
  show_id: string;
  venue_name: string;
  show_date: string;
  start_time: string;
  end_time: string;
  spot_type: PoolType;
  label: string;
  /** 0 for a free spot. */
  amount_paise: number;
  active: boolean;
  removed_at: string | null;
  /** null on an inactive line = released by the system. */
  removed_by: string | null;
  removed_reason: string | null;
  source_changed_at: string | null;
  created_at: string;
}

/** `billing_payments`: one row per payment attempt (a Razorpay Payment Link). */
export interface BillingPayment {
  id: string;
  bill_id: string;
  comedian_id: string;
  mode: BillingMode;
  /** Sent to Razorpay as reference_id (at most 40 characters, unique). */
  reference_id: string;
  /** null until the link has been created at Razorpay. */
  razorpay_payment_link_id: string | null;
  short_url: string | null;
  expires_at: string;
  amount_paise: number;
  status: PaymentAttemptStatus;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  method: string | null;
  /** What Razorpay actually captured (differs from amount_paise on amount_mismatch). */
  captured_amount_paise: number | null;
  fee_paise: number | null;
  tax_paise: number | null;
  captured_at: string | null;
  reconcile_flag: PaymentReconcileFlag | null;
  reconcile_resolved_at: string | null;
  reconcile_resolved_by: string | null;
  reconcile_note: string | null;
  refund_id: string | null;
  /** Free text until the refund test has shown Razorpay's real values. */
  refund_status: string | null;
  refunded_paise: number;
  created_at: string;
  updated_at: string;
}

/** `billing_events`: the append-only audit trail (fixed columns, no free-form metadata). */
export interface BillingAuditEvent {
  id: number;
  created_at: string;
  action: BillingAuditAction;
  bill_id: string | null;
  bill_number: string | null;
  from_status: string | null;
  to_status: string | null;
  amount_paise: number | null;
  week_start: string | null;
  comedian_id: string | null;
  comedian_name: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_owner_id: string | null;
  actor_id: string | null;
  actor_role: BillingActorRole | null;
  actor_name: string | null;
  reason: string | null;
  reference: string | null;
  payment_id: string | null;
  razorpay_payment_id: string | null;
  method: string | null;
  mode: BillingMode | null;
  fee_paise: number | null;
  is_demo: boolean;
}

export interface BillingException {
  id: string;
  venue_id: string;
  comedian_id: string;
  reason: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

/** `notifications`: in-app notices for comedians and owners. */
export interface BillingNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  bill_id: string | null;
  dedupe_key: string | null;
  created_at: string;
  read_at: string | null;
}
