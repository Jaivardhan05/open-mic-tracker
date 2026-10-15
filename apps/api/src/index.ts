import "dotenv/config";
import cors from 'cors';
import express from 'express';

import type { NextFunction, Request, Response } from 'express';
import { supabase, supabaseAdmin } from './lib/supabase.js';

interface AuthedRequest extends Request {
  userId?: string;
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.userId = data.user.id;
  next();
}

function requireRole(role: 'comedian' | 'venue_producer' | 'admin') {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userId = req.userId as string;

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data || data.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

const PROFILE_EDITABLE_FIELDS = [
  'phone',
  'bio',
  'contact_email',
  'youtube_url',
  'x_url',
  'instagram_url',
  'maps_url',
] as const;

type ProfileEditableField = (typeof PROFILE_EDITABLE_FIELDS)[number];

const VENUE_EDITABLE_FIELDS = [
  'instagram_url',
  'x_url',
  'maps_url',
  'contact_email',
  'contact_phone',
] as const;

type VenueEditableField = (typeof VENUE_EDITABLE_FIELDS)[number];

// Name, city and description are the venue's identity. The owner can change
// them only while the venue is waiting on, or being asked for changes by, the
// admin ("fix and resubmit"); once approved (or rejected/suspended) they are
// admin-only. Address is deliberately not editable anywhere yet.
const VENUE_DETAIL_FIELDS = ['name', 'city', 'description'] as const;
const OWNER_DETAIL_EDITABLE_STATUSES = ['pending', 'changes_requested'];
const VENUE_NAME_MIN = 2;
const VENUE_NAME_MAX = 100;
const VENUE_DESCRIPTION_MAX = 1000;
// The cities the owner and admin forms offer (the API is the single source;
// clients read it from GET /api/venues/mine/status). A venue's existing city
// is always accepted unchanged so venues outside this list are not locked out.
const VENUE_CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Pune'];

const FORBIDDEN_PROFILE_FIELDS = [
  'name',
  'full_name',
  'email',
  'role',
  'id',
  'is_active',
  'profile_picture',
  'city',
  'username',
  'password',
  'password_hash',
  'created_at',
  'updated_at',
];

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CORS_ORIGIN ?? '',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// The one place that defines "a venue the public may see": approved, active,
// not hidden and not suspended (mirrors venue_is_public in migration 018).
// Pass a column prefix for an embedded relation, e.g. 'venues.'. Every public
// read path uses this rather than its own list of conditions.
const PUBLIC_VENUE_CONDITIONS: ReadonlyArray<readonly [string, boolean]> = [
  ['admin_approved', true],
  ['is_active', true],
  ['is_hidden', false],
  ['is_suspended', false],
];

function publicVenueFilters<Q>(query: Q, prefix = ''): Q {
  // The Supabase builder's own generics are too deep to constrain here; the
  // type is passed through unchanged so callers keep chaining normally.
  return PUBLIC_VENUE_CONDITIONS.reduce(
    (q, [column, value]) => (q as unknown as { eq: (c: string, v: boolean) => Q }).eq(`${prefix}${column}`, value),
    query
  );
}

app.get('/api/venues', async (req: Request, res: Response) => {
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;

  let query = publicVenueFilters(
    supabase.from('venues').select('id, name, address, city, photos, description')
  );

  if (city) {
    query = query.ilike('city', city);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data ?? []);
});

app.get('/api/shows', async (req: Request, res: Response) => {
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const spot_type = typeof req.query.spot_type === 'string' ? req.query.spot_type : undefined;
  const after_time =
    typeof req.query.after_time === 'string' ? req.query.after_time : undefined;
  const before_time =
    typeof req.query.before_time === 'string' ? req.query.before_time : undefined;
  const venue_name =
    typeof req.query.venue_name === 'string' ? req.query.venue_name : undefined;

  if (spot_type && spot_type !== 'busking' && spot_type !== 'non_busking') {
    res.status(400).json({
      error: 'spot_type must be busking or non_busking',
    });
    return;
  }

  let query = publicVenueFilters(
    supabase
      .from('shows')
      .select(
        'id, venue_id, date, start_time, end_time, spot_type, total_spots, available_spots, charge, venues!inner(id, name, city, admin_approved, is_active, is_hidden, is_suspended)'
      )
      .eq('is_cancelled', false),
    'venues.'
  )
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (date) {
    query = query.eq('date', date);
  }
  if (spot_type) {
    query = query.eq('spot_type', spot_type);
  }
  if (after_time) {
    query = query.gte('start_time', after_time);
  }
  if (before_time) {
    query = query.lte('start_time', before_time);
  }
  if (city) {
    query = query.ilike('venues.city', city);
  }
  if (venue_name) {
    query = query.ilike('venues.name', `%${venue_name}%`);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const results = (data ?? []).map((show: {
    id: string;
    venue_id: string;
    date: string;
    start_time: string;
    end_time: string;
    spot_type: 'busking' | 'non_busking';
    total_spots: number;
    available_spots: number;
    charge: number;
  }) => ({
    id: show.id,
    venue_id: show.venue_id,
    date: show.date,
    start_time: show.start_time,
    end_time: show.end_time,
    spot_type: show.spot_type,
    total_spots: show.total_spots,
    available_spots: show.available_spots,
    charge: show.charge,
  }));

  res.status(200).json(results);
});


app.get('/api/venues/:id', async (req: Request, res: Response) => {
  const id = req.params.id;

  // Hidden and suspended venues 404 here too: this route used to ignore both,
  // so a hidden venue's detail and spots were reachable by id.
  const { data: venueRow, error: venueError } = await publicVenueFilters(
    supabase
      .from('venues')
      .select('id, name, address, city, photos, description, instagram_url, x_url, maps_url, contact_email, contact_phone, owner_id')
      .eq('id', id)
  ).maybeSingle();

  if (venueError) {
    res.status(500).json({ error: venueError.message });
    return;
  }

  if (!venueRow) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  const { owner_id, ...venue } = venueRow;

  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select('id, venue_id, date, start_time, end_time, spot_type, total_spots, available_spots, charge')
    .eq('venue_id', id)
    .eq('is_cancelled', false)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (showsError) {
    res.status(500).json({ error: showsError.message });
    return;
  }

  let spots: unknown[] = [];
  if (owner_id) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: spotsData, error: spotsError } = await supabaseAdmin
      .from('spots')
      .select(SPOT_SELECT)
      .eq('venue_producer_id', owner_id)
      .eq('is_cancelled', false)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (spotsError) {
      res.status(500).json({ error: spotsError.message });
      return;
    }
    spots = spotsData ?? [];
  }

  res.status(200).json({ venue, shows: shows ?? [], spots });
});

// Shared by PATCH /api/venues/mine and PATCH /api/venues/:id — validates
// and applies VENUE_EDITABLE_FIELDS to a venue row already confirmed to
// belong to the requesting venue producer. See specs/venue-social-links.md
// (bug: venue-producer profile edits were writing instagram_url/maps_url/
// contact_email to the `users` table instead of `venues`, which is what
// /venues' Connect component actually reads).
async function applyVenueEditableUpdates(res: Response, venueId: string, body: Record<string, unknown>) {
  const updates: Partial<Record<VenueEditableField | (typeof VENUE_DETAIL_FIELDS)[number], string | null>> = {};

  for (const field of VENUE_EDITABLE_FIELDS) {
    if (!(field in body)) {
      continue;
    }
    const raw = body[field];
    if (raw !== null && typeof raw !== 'string') {
      res.status(400).json({ error: `${field} must be a string` });
      return;
    }
    const trimmed: string | null = typeof raw === 'string' ? raw.trim() : null;
    updates[field] = trimmed === '' ? null : trimmed;
  }

  let hasDetailFields = false;
  for (const field of VENUE_DETAIL_FIELDS) {
    if (!(field in body)) {
      continue;
    }
    hasDetailFields = true;
    const raw = body[field];
    if (typeof raw !== 'string') {
      res.status(400).json({ error: `${field} must be a string` });
      return;
    }
    const trimmed = raw.trim();

    if (field === 'name' && (trimmed.length < VENUE_NAME_MIN || trimmed.length > VENUE_NAME_MAX)) {
      res.status(400).json({ error: `Venue name must be ${VENUE_NAME_MIN}-${VENUE_NAME_MAX} characters` });
      return;
    }
    if (field === 'description' && trimmed.length > VENUE_DESCRIPTION_MAX) {
      res.status(400).json({ error: `Description must be ${VENUE_DESCRIPTION_MAX} characters or fewer` });
      return;
    }
    if (field === 'city' && !VENUE_CITIES.includes(trimmed)) {
      const { data: current } = await supabaseAdmin.from('venues').select('city').eq('id', venueId).maybeSingle();
      if (current?.city !== trimmed) {
        res.status(400).json({ error: `City must be one of: ${VENUE_CITIES.join(', ')}` });
        return;
      }
    }

    updates[field] = trimmed;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No editable fields provided' });
    return;
  }

  if (updates.contact_email && !/^[^@]+@[^@]+\.[^@]+$/.test(updates.contact_email)) {
    res.status(400).json({ error: 'Invalid contact email format' });
    return;
  }

  for (const urlField of ['instagram_url', 'x_url', 'maps_url'] as const) {
    const value = updates[urlField];
    if (value && !/^https?:\/\//i.test(value)) {
      res.status(400).json({ error: `${urlField} must start with http:// or https://` });
      return;
    }
  }

  let query = supabaseAdmin.from('venues').update(updates).eq('id', venueId);
  if (hasDetailFields) {
    // The status check rides on the UPDATE itself, so an admin approving the
    // venue at the same moment cannot be raced past.
    query = query.in('review_status', OWNER_DETAIL_EDITABLE_STATUSES);
  }

  const { data, error } = await query
    .select('id, name, address, city, photos, description, instagram_url, x_url, maps_url, contact_email, contact_phone')
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    if (hasDetailFields) {
      res.status(409).json({
        error: 'Name, city and description can only be changed while the venue is pending or has changes requested',
      });
    } else {
      res.status(404).json({ error: 'Venue not found' });
    }
    return;
  }

  res.status(200).json(data);
}

const OWNER_VENUE_STATUS_SELECT =
  'id, name, city, description, review_status, review_reason, reviewed_at, submitted_at, admin_approved, is_active, is_suspended, suspension_reason, suspended_at';

// The owner's own venue state for their dashboard: where it stands in review,
// the admin's note, and what they may do next. Does not expose hide state.
app.get('/api/venues/mine/status', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select(OWNER_VENUE_STATUS_SELECT)
    .eq('owner_id', req.userId as string)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'No venue found for this account' });
    return;
  }

  const { admin_approved, is_active, ...venue } = data;
  res.status(200).json({
    ...venue,
    can_operate: admin_approved && is_active && !venue.is_suspended,
    can_edit_details: OWNER_DETAIL_EDITABLE_STATUSES.includes(venue.review_status),
    allowed_cities: VENUE_CITIES,
  });
});

// changes_requested -> pending (back into the admin's queue).
app.post('/api/venues/mine/resubmit', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.rpc('owner_resubmit_venue', {
    p_owner_id: req.userId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data?.success) {
    const message = typeof data?.error === 'string' ? data.error : 'Could not resubmit';
    res.status(/no venue found/i.test(message) ? 404 : 409).json({ error: message });
    return;
  }

  res.status(200).json({ success: true });
});

// Lets a venue producer update their own venue's social/contact links
// without already knowing their venue's id (the profile-edit form only
// has the logged-in user's id). Must be registered before /api/venues/:id
// so Express doesn't match "mine" as an :id param.
app.patch('/api/venues/mine', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const { data: venueRow, error: venueError } = await supabaseAdmin
    .from('venues')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (venueError) {
    res.status(500).json({ error: venueError.message });
    return;
  }

  if (!venueRow) {
    res.status(404).json({ error: 'No venue found for this account' });
    return;
  }

  await applyVenueEditableUpdates(res, venueRow.id, body);
});

app.patch('/api/venues/:id', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const { data: venueRow, error: venueError } = await supabaseAdmin
    .from('venues')
    .select('owner_id')
    .eq('id', id)
    .maybeSingle();

  if (venueError) {
    res.status(500).json({ error: venueError.message });
    return;
  }

  if (!venueRow || venueRow.owner_id !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await applyVenueEditableUpdates(res, id, body);
});

app.post('/api/venues/:id/approve', requireUser, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.rpc('admin_approve_venue', { p_venue_id: id });

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data);
});

// Default-deny: every route registered under /api/admin after this line needs
// a valid session AND the admin role, even if its own definition forgets the
// per-route middleware. Keep new admin routes below this line.
app.use('/api/admin', requireUser, requireRole('admin'));

// Lets the /admin pages ask the server (not localStorage) whether the current
// session is an admin. Non-admins get 403 from the prefix guard above.
app.get('/api/admin/me', async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('id', req.userId as string)
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'Failed to load admin profile' });
    return;
  }

  res.status(200).json({ id: data.id, name: data.name, role: 'admin' });
});

// Every venue in every state, for /admin/venues. Deliberately omits address
// (out of scope, see specs/admin-venue-management.md). Oldest submission
// first so the review queue reads in order.
app.get('/api/admin/manage/venues', async (_req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select(
      'id, name, city, owner_id, review_status, review_reason, reviewed_at, submitted_at, is_hidden, hidden_reason, is_suspended, suspension_reason, suspended_at, created_at, updated_at'
    )
    .order('submitted_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = data ?? [];
  const ownerIds = Array.from(new Set(rows.map((v) => v.owner_id).filter(Boolean)));

  const owners: Record<string, { name: string; email: string }> = {};
  if (ownerIds.length > 0) {
    const { data: ownerRows, error: ownersError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', ownerIds);

    if (ownersError) {
      res.status(500).json({ error: ownersError.message });
      return;
    }

    (ownerRows ?? []).forEach((o: { id: string; name: string; email: string }) => {
      owners[o.id] = { name: o.name, email: o.email };
    });
  }

  res.status(200).json(
    rows.map((v) => ({
      ...v,
      owner_name: owners[v.owner_id]?.name ?? null,
      owner_email: owners[v.owner_id]?.email ?? null,
    }))
  );
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_REASON_MAX = 500;

// Runs one venue review RPC (migration 018) and maps its { success, error }
// result to HTTP: not found -> 404, wrong starting state -> 409. The RPC does
// the state check and the update in one statement, so two admins acting on
// the same venue cannot both win.
async function runVenueReviewAction(
  res: Response,
  rpcName:
    | 'admin_approve_venue'
    | 'admin_reject_venue'
    | 'admin_request_changes'
    | 'admin_suspend_venue'
    | 'admin_unsuspend_venue'
    | 'venue_suspension_preview',
  args: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin.rpc(rpcName, args);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data?.success) {
    const message = typeof data?.error === 'string' ? data.error : 'Action failed';
    res.status(/not found/i.test(message) ? 404 : 409).json({ error: message });
    return;
  }

  res.status(200).json(data);
}

// Required, non-blank, bounded reason (reject / request changes). The owner
// reads it verbatim on their dashboard.
function parseReviewReason(body: unknown): { reason: string } | { error: string } {
  const raw = (body as { reason?: unknown } | null)?.reason;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { error: 'A reason is required' };
  }
  const reason = raw.trim();
  if (reason.length > REVIEW_REASON_MAX) {
    return { error: `Reason must be ${REVIEW_REASON_MAX} characters or fewer` };
  }
  return { reason };
}

app.post('/api/admin/manage/venues/:id/approve', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  await runVenueReviewAction(res, 'admin_approve_venue', {
    p_venue_id: id,
    p_admin_id: req.userId,
  });
});

app.post('/api/admin/manage/venues/:id/reject', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  const parsed = parseReviewReason(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  await runVenueReviewAction(res, 'admin_reject_venue', {
    p_venue_id: id,
    p_reason: parsed.reason,
    p_admin_id: req.userId,
  });
});

app.post('/api/admin/manage/venues/:id/request-changes', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  const parsed = parseReviewReason(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  await runVenueReviewAction(res, 'admin_request_changes', {
    p_venue_id: id,
    p_reason: parsed.reason,
    p_admin_id: req.userId,
  });
});

// Suspension (migration 021). Suspending cancels every upcoming show and its
// pending / accepted / waitlisted requests in the same transaction; unsuspending
// restores nothing. The preview uses the same "upcoming" predicate as the
// suspend, so the counts an admin confirms are the counts acted on (give or
// take anything that changes between the two calls; the suspend response
// carries the real numbers).
app.get('/api/admin/manage/venues/:id/suspension-preview', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  await runVenueReviewAction(res, 'venue_suspension_preview', { p_venue_id: id });
});

app.post('/api/admin/manage/venues/:id/suspend', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  const parsed = parseReviewReason(req.body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  await runVenueReviewAction(res, 'admin_suspend_venue', {
    p_venue_id: id,
    p_reason: parsed.reason,
    p_admin_id: req.userId,
  });
});

app.post('/api/admin/manage/venues/:id/unsuspend', async (req: AuthedRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  await runVenueReviewAction(res, 'admin_unsuspend_venue', {
    p_venue_id: id,
    p_admin_id: req.userId,
  });
});

app.get('/api/admin/stats', requireUser, requireRole('admin'), async (_req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.rpc('get_platform_stats');

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data);
});

app.get('/api/admin/pending-venues', requireUser, requireRole('admin'), async (_req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select('id, name, address, city, owner_id, created_at, admin_approved')
    .eq('review_status', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  if (!data || data.length === 0) {
    return res.status(200).json([]);
  }

  const ownerIds = data.map((v) => v.owner_id).filter(Boolean);

  let ownersMap: Record<string, { name: string; email: string }> = {};

  if (ownerIds.length > 0) {
    const { data: owners } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', ownerIds);

    if (owners) {
      owners.forEach((o: { id: string; name: string; email: string }) => {
        ownersMap[o.id] = {
          name: o.name,
          email: o.email,
        };
      });
    }
  }

  const result = data.map((v) => ({
    ...v,
    ownerName: ownersMap[v.owner_id]?.name ?? 'Unknown',
    ownerEmail: ownersMap[v.owner_id]?.email ?? '',
  }));

  return res.status(200).json(result);
});

app.post('/api/venues/:id/reject', requireUser, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.rpc('admin_reject_venue', { p_venue_id: id });

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data);
});

app.get('/api/admin/venues', requireUser, requireRole('admin'), async (_req: AuthedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select('id, name, address, city, admin_approved, is_hidden, hidden_reason')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data ?? []);
});

app.post('/api/venues/:id/hide', requireUser, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

  const { data, error } = await supabaseAdmin.rpc('admin_hide_venue', {
    p_venue_id: id,
    p_reason: reason,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/venues/:id/unhide', requireUser, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin.rpc('admin_unhide_venue', { p_venue_id: id });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.patch('/api/users/me', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const forbiddenKeysPresent = FORBIDDEN_PROFILE_FIELDS.filter((key) => key in body);
  if (forbiddenKeysPresent.length > 0) {
    res.status(400).json({
      error: `Cannot update field(s): ${forbiddenKeysPresent.join(', ')}`,
    });
    return;
  }

  const updates: Partial<Record<ProfileEditableField, string | null>> = {};

  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (!(field in body)) {
      continue;
    }
    const raw = body[field];
    if (raw !== null && typeof raw !== 'string') {
      res.status(400).json({ error: `${field} must be a string` });
      return;
    }
    const trimmed: string | null = typeof raw === 'string' ? raw.trim() : null;
    updates[field] = trimmed === '' ? null : trimmed;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No editable fields provided' });
    return;
  }

  if (updates.phone && !/^\+?[0-9]{10,15}$/.test(updates.phone)) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  if (updates.bio && updates.bio.length > 500) {
    res.status(400).json({ error: 'Bio must be 500 characters or fewer' });
    return;
  }

  if (updates.contact_email && !/^[^@]+@[^@]+\.[^@]+$/.test(updates.contact_email)) {
    res.status(400).json({ error: 'Invalid contact email format' });
    return;
  }

  for (const urlField of ['youtube_url', 'x_url', 'instagram_url', 'maps_url'] as const) {
    const value = updates[urlField];
    if (value && !/^https?:\/\//i.test(value)) {
      res.status(400).json({ error: `${urlField} must start with http:// or https://` });
      return;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, name, email, phone, bio, contact_email, youtube_url, x_url, instagram_url, maps_url, role, created_at')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

interface BookingRow {
  id: string;
  slots_booked: number;
  booking_status: string;
  payment_status: string;
  booked_at: string;
  shows: {
    id: string;
    venue_id: string;
    date: string;
    start_time: string;
    end_time: string;
    spot_type: 'busking' | 'non_busking';
    total_spots: number;
    available_spots: number;
    charge: number;
    venues: {
      id: string;
      name: string;
      address: string;
      city: string;
      photos: string[];
      description: string;
    } | null;
  } | null;
}

const BOOKING_SELECT =
  'id, slots_booked, booking_status, payment_status, booked_at, shows:show_id(id, venue_id, date, start_time, end_time, spot_type, total_spots, available_spots, charge, venues(id, name, address, city, photos, description))';

function serializeBooking(row: BookingRow) {
  return {
    id: row.id,
    slots_booked: row.slots_booked,
    booking_status: row.booking_status,
    payment_status: row.payment_status,
    booked_at: row.booked_at,
    show: row.shows,
    venue: row.shows?.venues ?? null,
  };
}

app.get('/api/me/bookings/pending', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('comedian_id', userId)
    .in('booking_status', ['awaiting_confirmation', 'confirmed_awaiting_comedian'])
    .order('booked_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(((data ?? []) as unknown as BookingRow[]).map(serializeBooking));
});

app.get('/api/me/favorite-venues', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('comedian_id', userId)
    .not('booking_status', 'in', '(declined_by_comedian,cancelled_by_comedian)')
    .order('booked_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const bookingRows = ((data ?? []) as unknown as BookingRow[]).filter((row) => row.shows?.venues);

  // Only venues the public can still open: a favorite card links to the venue
  // page, which now 404s for hidden and suspended venues. The comedian's own
  // booking history (/api/me/bookings/pending) is deliberately not filtered.
  const venueIds = Array.from(new Set(bookingRows.map((row) => row.shows!.venues!.id)));
  const publicVenueIds = new Set<string>();
  if (venueIds.length > 0) {
    const { data: publicVenues, error: publicVenuesError } = await publicVenueFilters(
      supabaseAdmin.from('venues').select('id').in('id', venueIds)
    );

    if (publicVenuesError) {
      res.status(500).json({ error: publicVenuesError.message });
      return;
    }
    (publicVenues ?? []).forEach((v: { id: string }) => publicVenueIds.add(v.id));
  }
  const rows = bookingRows.filter((row) => publicVenueIds.has(row.shows!.venues!.id));

  const venueStats = new Map<
    string,
    { venue: NonNullable<BookingRow['shows']>['venues']; count: number; lastBookedAt: string }
  >();

  for (const row of rows) {
    const venue = row.shows!.venues!;
    const existing = venueStats.get(venue.id);
    if (existing) {
      existing.count += 1;
      if (row.booked_at > existing.lastBookedAt) {
        existing.lastBookedAt = row.booked_at;
      }
    } else {
      venueStats.set(venue.id, { venue, count: 1, lastBookedAt: row.booked_at });
    }
  }

  const favorites = Array.from(venueStats.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.lastBookedAt < b.lastBookedAt ? 1 : -1;
    })
    .slice(0, 3)
    .map((entry) => ({ ...entry.venue, booking_count: entry.count }));

  res.status(200).json(favorites);
});

app.post('/api/shows/:id/book', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const slots = typeof req.body?.slots === 'number' ? req.body.slots : 1;

  const { data, error } = await supabaseAdmin.rpc('book_show_spot', {
    p_show_id: id,
    p_comedian_id: userId,
    p_slots: slots,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/bookings/:id/cancel', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin.rpc('comedian_cancel_booking', {
    p_booking_id: id,
    p_comedian_id: userId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/bookings/:id/decline', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin.rpc('comedian_decline_booking', {
    p_booking_id: id,
    p_comedian_id: userId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

// Test/seed helper: simulates a venue producer confirming a booking.
// No venue-dashboard UI wires this yet — see specs/dashboard-spec.md.
app.post('/api/bookings/:id/confirm', async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin.rpc('venue_confirm_booking', {
    p_booking_id: id,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

const SPOT_SELECT =
  'id, venue_producer_id, date, start_time, end_time, spot_type, total_spots, available_spots, price, is_cancelled, cancellation_message, created_at';

async function venuesByProducerIds(
  producerIds: string[]
): Promise<Record<string, { id: string; name: string }>> {
  if (producerIds.length === 0) {
    return {};
  }

  const { data } = await supabaseAdmin
    .from('venues')
    .select('id, owner_id, name')
    .in('owner_id', producerIds);

  const map: Record<string, { id: string; name: string }> = {};
  (data ?? []).forEach((v: { id: string; owner_id: string; name: string }) => {
    map[v.owner_id] = { id: v.id, name: v.name };
  });
  return map;
}

app.get('/api/spots', async (_req: Request, res: Response) => {
  const { data: venues, error: venuesError } = await publicVenueFilters(
    supabase.from('venues').select('id, owner_id')
  ).not('owner_id', 'is', null);

  if (venuesError) {
    res.status(500).json({ error: venuesError.message });
    return;
  }

  const venueIdByOwnerId: Record<string, string> = {};
  (venues ?? []).forEach((v: { id: string; owner_id: string }) => {
    venueIdByOwnerId[v.owner_id] = v.id;
  });

  const ownerIds = Object.keys(venueIdByOwnerId);
  if (ownerIds.length === 0) {
    res.status(200).json([]);
    return;
  }

  // Compatibility shim for the (not-yet-updated) comedian-facing /venues
  // pages: hosting pools are excluded so their flat busking/non_busking-only
  // shape keeps working unmodified. See specs/venue-dashboard.md §9.3.
  const today = new Date().toISOString().slice(0, 10);
  const { data: spots, error: spotsError } = await supabaseAdmin
    .from('spots')
    .select(SPOT_SELECT)
    .in('venue_producer_id', ownerIds)
    .eq('is_cancelled', false)
    .neq('spot_type', 'hosting')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (spotsError) {
    res.status(500).json({ error: spotsError.message });
    return;
  }

  const results = (spots ?? []).map((spot: {
    id: string;
    venue_producer_id: string;
    date: string;
    start_time: string;
    end_time: string;
    spot_type: 'busking' | 'non_busking';
    total_spots: number;
    available_spots: number;
    price: number | null;
  }) => ({
    id: spot.id,
    venue_id: venueIdByOwnerId[spot.venue_producer_id],
    date: spot.date,
    start_time: spot.start_time,
    end_time: spot.end_time,
    spot_type: spot.spot_type,
    total_spots: spot.total_spots,
    available_spots: spot.available_spots,
    charge: spot.price ?? 0,
  }));

  res.status(200).json(results);
});

// Extracts and validates the 3-pool body shared by create/edit. Returns
// either the normalized fields or an error string. See
// specs/venue-dashboard.md §9 for the busking/non_busking/hosting model.
function parsePoolsBody(body: Record<string, unknown>):
  | {
      error: string;
    }
  | {
      error?: undefined;
      buskingSpots: number;
      buskingPrice: number | null;
      nonBuskingSpots: number;
      nonBuskingPrice: number | null;
      hosting: boolean;
      hostingPrice: number | null;
    } {
  const { busking_spots, busking_price, non_busking_spots, non_busking_price, hosting, hosting_price } = body;

  if (typeof busking_spots !== 'number' || !Number.isInteger(busking_spots) || busking_spots < 0 || busking_spots > 100) {
    return { error: 'busking_spots must be an integer between 0 and 100' };
  }
  if (typeof non_busking_spots !== 'number' || !Number.isInteger(non_busking_spots) || non_busking_spots < 0 || non_busking_spots > 100) {
    return { error: 'non_busking_spots must be an integer between 0 and 100' };
  }
  if (typeof hosting !== 'boolean') {
    return { error: 'hosting must be a boolean' };
  }
  if (busking_spots === 0 && non_busking_spots === 0 && !hosting) {
    return { error: 'At least one of busking, non-busking, or hosting must have a spot' };
  }

  function normalizePrice(value: unknown, label: string): number | null | { error: string } {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'number' || value < 0) return { error: `${label} must be a non-negative number` };
    return value;
  }

  const buskingPrice = normalizePrice(busking_price, 'busking_price');
  if (buskingPrice !== null && typeof buskingPrice === 'object') return buskingPrice;
  const nonBuskingPrice = normalizePrice(non_busking_price, 'non_busking_price');
  if (nonBuskingPrice !== null && typeof nonBuskingPrice === 'object') return nonBuskingPrice;
  const hostingPrice = normalizePrice(hosting_price, 'hosting_price');
  if (hostingPrice !== null && typeof hostingPrice === 'object') return hostingPrice;

  return {
    buskingSpots: busking_spots,
    buskingPrice: buskingPrice as number | null,
    nonBuskingSpots: non_busking_spots,
    nonBuskingPrice: nonBuskingPrice as number | null,
    hosting,
    hostingPrice: hostingPrice as number | null,
  };
}

const VENUE_SHOW_SELECT =
  'id, venue_producer_id, date, start_time, end_time, is_cancelled, cancellation_message, created_at, spots(id, date, start_time, end_time, spot_type, total_spots, available_spots, price, is_cancelled, cancellation_message, created_at)';

type VenueShowRow = {
  id: string;
  venue_producer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_cancelled: boolean;
  cancellation_message: string | null;
  created_at: string;
  spots: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    spot_type: 'busking' | 'non_busking' | 'hosting';
    total_spots: number;
    available_spots: number;
    price: number | null;
    is_cancelled: boolean;
    cancellation_message: string | null;
    created_at: string;
  }[];
};

// Reshapes the joined venue_shows + spots rows into the VenueShow shape
// (packages/types) the dashboard UI consumes: one named slot per pool
// type, null when that pool has no active row. Each pool includes its own
// date/start_time/end_time (denormalized from the show, see
// specs/venue-dashboard.md §9.1) since RequestsPanel keys off a pool's own
// spots.id and needs those fields directly on it.
function toVenueShow(row: VenueShowRow) {
  const activePool = (type: 'busking' | 'non_busking' | 'hosting') => {
    const pool = row.spots.find((s) => s.spot_type === type && !s.is_cancelled);
    return pool ? { ...pool, venue_producer_id: row.venue_producer_id } : null;
  };

  return {
    id: row.id,
    venue_producer_id: row.venue_producer_id,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    is_cancelled: row.is_cancelled,
    cancellation_message: row.cancellation_message,
    created_at: row.created_at,
    busking: activePool('busking'),
    non_busking: activePool('non_busking'),
    hosting: activePool('hosting'),
  };
}

app.post('/api/venue-shows', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { date, start_time, end_time } = body;

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be a YYYY-MM-DD string' });
    return;
  }
  if (typeof start_time !== 'string' || typeof end_time !== 'string') {
    res.status(400).json({ error: 'start_time and end_time are required' });
    return;
  }
  if (start_time >= end_time) {
    res.status(400).json({ error: 'end_time must be after start_time' });
    return;
  }

  const pools = parsePoolsBody(body);
  if (pools.error) {
    res.status(400).json({ error: pools.error });
    return;
  }

  const { data, error } = await supabaseAdmin.rpc('create_show', {
    p_venue_producer_id: userId,
    p_date: date,
    p_start_time: start_time,
    p_end_time: end_time,
    p_busking_spots: pools.buskingSpots,
    p_busking_price: pools.buskingPrice,
    p_non_busking_spots: pools.nonBuskingSpots,
    p_non_busking_price: pools.nonBuskingPrice,
    p_hosting: pools.hosting,
    p_hosting_price: pools.hostingPrice,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data?.success) {
    res.status(400).json({ error: data?.error ?? 'Failed to create show' });
    return;
  }

  res.status(200).json(data);
});

app.get('/api/venue-shows/mine', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  // Cancelled shows drop off this list once their own date has passed,
  // regardless of when they were cancelled. Active shows are unaffected —
  // they keep showing regardless of date. See specs/venue-dashboard.md §5.1.
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('venue_shows')
    .select(VENUE_SHOW_SELECT)
    .eq('venue_producer_id', userId)
    .or(`is_cancelled.eq.false,date.gte.${today}`)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(((data ?? []) as unknown as VenueShowRow[]).map(toVenueShow));
});

app.get('/api/venue-producer/notices', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  const { data, error } = await supabaseAdmin
    .from('venue_notices')
    .select('id, venue_id, venue_name, reason, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data ?? []);
});

app.post('/api/venue-shows/:id/cancel', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const message = typeof req.body?.message === 'string' ? req.body.message : undefined;

  const { data, error } = await supabaseAdmin.rpc('cancel_show', {
    p_show_id: id,
    p_venue_producer_id: userId,
    p_message: message,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/venue-shows/:id/edit', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { date } = body;

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be a YYYY-MM-DD string' });
    return;
  }

  const pools = parsePoolsBody(body);
  if (pools.error) {
    res.status(400).json({ error: pools.error });
    return;
  }

  const { data, error } = await supabaseAdmin.rpc('update_show', {
    p_show_id: id,
    p_venue_producer_id: userId,
    p_date: date,
    p_busking_spots: pools.buskingSpots,
    p_busking_price: pools.buskingPrice,
    p_non_busking_spots: pools.nonBuskingSpots,
    p_non_busking_price: pools.nonBuskingPrice,
    p_hosting: pools.hosting,
    p_hosting_price: pools.hostingPrice,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.get('/api/spots/:id/requests', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;

  const { data: spot, error: spotError } = await supabaseAdmin
    .from('spots')
    .select(SPOT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (spotError) {
    res.status(500).json({ error: spotError.message });
    return;
  }
  if (!spot || spot.venue_producer_id !== userId) {
    res.status(404).json({ error: 'Spot not found' });
    return;
  }

  const { data: requests, error: requestsError } = await supabaseAdmin
    .from('spot_requests')
    .select('id, spot_id, comedian_id, status, venue_message, requested_at, decided_at, show_id')
    .eq('spot_id', id)
    // id is a deterministic tiebreaker for identical requested_at values.
    .order('requested_at', { ascending: true })
    .order('id', { ascending: true });

  if (requestsError) {
    res.status(500).json({ error: requestsError.message });
    return;
  }

  const comedianIds = (requests ?? []).map((r) => r.comedian_id);
  type ComedianInfo = {
    name: string;
    instagram_url: string | null;
    x_url: string | null;
    youtube_url: string | null;
    contact_email: string | null;
  };
  let comedianInfo: Record<string, ComedianInfo> = {};
  if (comedianIds.length > 0) {
    const { data: comedians } = await supabaseAdmin
      .from('users')
      .select('id, name, instagram_url, x_url, youtube_url, contact_email')
      .in('id', comedianIds);
    (comedians ?? []).forEach(
      (c: { id: string } & ComedianInfo) => {
        comedianInfo[c.id] = {
          name: c.name,
          instagram_url: c.instagram_url,
          x_url: c.x_url,
          youtube_url: c.youtube_url,
          contact_email: c.contact_email,
        };
      }
    );
  }

  // A pending/waitlisted request is "blocked" when the same comedian is already
  // accepted for another spot in the same show. It stays acceptable: accepting
  // it is a swap (see accept_spot_request, migration 017a).
  const blockedBy: Record<string, { request_id: string; spot_type: string }> = {};
  const waitingRows = (requests ?? []).filter((r) => r.status === 'pending' || r.status === 'waitlisted');
  if (waitingRows.length > 0) {
    const { data: acceptedSiblings, error: siblingsError } = await supabaseAdmin
      .from('spot_requests')
      .select('id, comedian_id, spots:spot_id(spot_type)')
      .eq('show_id', waitingRows[0].show_id)
      .eq('status', 'accepted')
      .in('comedian_id', waitingRows.map((r) => r.comedian_id));

    if (siblingsError) {
      res.status(500).json({ error: siblingsError.message });
      return;
    }

    (acceptedSiblings as unknown as Array<{ id: string; comedian_id: string; spots: { spot_type: string } | null }> ?? []).forEach(
      (s) => {
        if (s.spots) {
          blockedBy[s.comedian_id] = { request_id: s.id, spot_type: s.spots.spot_type };
        }
      }
    );
  }

  const enriched = (requests ?? []).map(({ show_id: _showId, ...r }) => ({
    ...r,
    blocked_by:
      r.status === 'pending' || r.status === 'waitlisted' ? (blockedBy[r.comedian_id] ?? null) : null,
    comedian_name: comedianInfo[r.comedian_id]?.name,
    comedian_instagram_url: comedianInfo[r.comedian_id]?.instagram_url ?? null,
    comedian_x_url: comedianInfo[r.comedian_id]?.x_url ?? null,
    comedian_youtube_url: comedianInfo[r.comedian_id]?.youtube_url ?? null,
    comedian_contact_email: comedianInfo[r.comedian_id]?.contact_email ?? null,
  }));

  const grouped = {
    pending: enriched.filter((r) => r.status === 'pending'),
    accepted: enriched.filter((r) => r.status === 'accepted'),
    waitlisted: enriched.filter((r) => r.status === 'waitlisted'),
    cancelled_by_comedian: enriched.filter((r) => r.status === 'cancelled_by_comedian'),
    cancelled_by_venue: enriched.filter((r) => r.status === 'cancelled_by_venue'),
  };

  res.status(200).json({ spot, requests: grouped });
});

app.post('/api/spot-requests', requireUser, requireRole('comedian'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const spotId = typeof req.body?.spot_id === 'string' ? req.body.spot_id : undefined;

  if (!spotId) {
    res.status(400).json({ error: 'spot_id is required' });
    return;
  }

  const { data, error } = await supabaseAdmin.rpc('apply_to_spot', {
    p_spot_id: spotId,
    p_comedian_id: userId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/spot-requests/:id/accept', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const message = typeof req.body?.message === 'string' ? req.body.message : undefined;
  const swapFromRequestId =
    typeof req.body?.swap_from_request_id === 'string' ? req.body.swap_from_request_id : undefined;

  const { data, error } = await supabaseAdmin.rpc('accept_spot_request', {
    p_request_id: id,
    p_venue_producer_id: userId,
    p_message: message,
    p_swap_from_request_id: swapFromRequestId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/spot-requests/:id/venue-cancel', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const message = typeof req.body?.message === 'string' ? req.body.message : undefined;

  const { data, error } = await supabaseAdmin.rpc('venue_cancel_spot_request', {
    p_request_id: id,
    p_venue_producer_id: userId,
    p_message: message,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.post('/api/spot-requests/:id/cancel', requireUser, requireRole('comedian'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin.rpc('comedian_cancel_spot_request', {
    p_request_id: id,
    p_comedian_id: userId,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.get('/api/spot-requests/mine', requireUser, requireRole('comedian'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  // cancelled_by_venue requests drop off the comedian's view 24h after the
  // cancellation (decided_at is overwritten on every status transition, so
  // it doubles as the cancellation timestamp for this status). All other
  // statuses are unaffected by this cutoff.
  const cancelledVisibilityCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: requests, error } = await supabaseAdmin
    .from('spot_requests')
    .select(`id, spot_id, show_id, comedian_id, status, venue_message, edit_notice, edit_notice_at, requested_at, decided_at, spots:spot_id(${SPOT_SELECT})`)
    .eq('comedian_id', userId)
    .or(`status.neq.cancelled_by_venue,decided_at.gt.${cancelledVisibilityCutoff}`)
    .order('requested_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  type RequestRow = {
    id: string;
    spot_id: string;
    show_id: string;
    comedian_id: string;
    status: string;
    venue_message: string | null;
    edit_notice: string | null;
    edit_notice_at: string | null;
    requested_at: string;
    decided_at: string | null;
    spots: Record<string, unknown> & { venue_producer_id: string };
  };

  const rows = (requests ?? []) as unknown as RequestRow[];
  const producerIds = rows.map((r) => r.spots?.venue_producer_id).filter(Boolean);
  const venues = await venuesByProducerIds(producerIds);

  // The comedian's own accepted request per show, so their other (pending or
  // waitlisted) requests in that show can be flagged as blocked. All of the
  // comedian's non-expired requests are already in `rows`.
  const acceptedSpotTypeByShow: Record<string, string> = {};
  rows.forEach((r) => {
    if (r.status === 'accepted' && typeof r.spots?.spot_type === 'string') {
      acceptedSpotTypeByShow[r.show_id] = r.spots.spot_type;
    }
  });

  const result = rows.map((r) => ({
    id: r.id,
    spot_id: r.spot_id,
    comedian_id: r.comedian_id,
    status: r.status,
    blocked_by_spot_type:
      r.status === 'pending' || r.status === 'waitlisted' ? (acceptedSpotTypeByShow[r.show_id] ?? null) : null,
    venue_message: r.venue_message,
    edit_notice: r.edit_notice,
    edit_notice_at: r.edit_notice_at,
    requested_at: r.requested_at,
    decided_at: r.decided_at,
    spot: r.spots,
    venue_id: venues[r.spots?.venue_producer_id]?.id ?? null,
    venue_name: venues[r.spots?.venue_producer_id]?.name ?? 'Venue',
  }));

  res.status(200).json(result);
});

app.listen(PORT, () => {
  console.log('OpenMic API running at http://localhost:' + PORT);
});
