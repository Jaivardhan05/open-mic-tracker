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

const COMEDIAN_EDITABLE_FIELDS = [
  'phone',
  'bio',
  'contact_email',
  'youtube_url',
  'x_url',
  'instagram_url',
] as const;

type ComedianEditableField = (typeof COMEDIAN_EDITABLE_FIELDS)[number];

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

app.get('/api/venues', async (req: Request, res: Response) => {
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;

  let query = supabase
    .from('venues')
    .select('id, name, address, city, photos, description')
    .eq('admin_approved', true)
    .eq('is_active', true)
    .eq('is_hidden', false);

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

  let query = supabase
    .from('shows')
    .select(
      'id, venue_id, date, start_time, end_time, spot_type, total_spots, available_spots, charge, venues!inner(id, name, city, admin_approved, is_active, is_hidden)'
    )
    .eq('is_cancelled', false)
    .eq('venues.admin_approved', true)
    .eq('venues.is_active', true)
    .eq('venues.is_hidden', false)
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

  const { data: venueRow, error: venueError } = await supabase
    .from('venues')
    .select('id, name, address, city, photos, description, owner_id')
    .eq('id', id)
    .eq('admin_approved', true)
    .eq('is_active', true)
    .maybeSingle();

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

app.post('/api/venues/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.rpc('admin_approve_venue', { p_venue_id: id });

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data);
});

app.get('/api/admin/stats', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.rpc('get_platform_stats');

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json(data);
});

app.get('/api/admin/pending-venues', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select('id, name, address, city, owner_id, created_at, admin_approved')
    .eq('admin_approved', false)
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

app.post('/api/venues/:id/reject', async (req: Request, res: Response) => {
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

  const updates: Partial<Record<ComedianEditableField, string | null>> = {};

  for (const field of COMEDIAN_EDITABLE_FIELDS) {
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

  for (const urlField of ['youtube_url', 'x_url', 'instagram_url'] as const) {
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
    .select('id, name, email, phone, bio, contact_email, youtube_url, x_url, instagram_url, role, created_at')
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

app.get('/api/me/bookings/upcoming', requireUser, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : 7;
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 30) : 7;

  const today = new Date();
  const toDateString = (d: Date) => d.toISOString().slice(0, 10);
  const startDate = toDateString(today);
  const endDate = toDateString(new Date(today.getTime() + (days - 1) * 24 * 60 * 60 * 1000));

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('comedian_id', userId)
    .not('booking_status', 'in', '(declined_by_comedian,cancelled_by_comedian)')
    .gte('shows.date', startDate)
    .lte('shows.date', endDate);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const results = ((data ?? []) as unknown as BookingRow[])
    .filter((row) => row.shows && row.shows.date >= startDate && row.shows.date <= endDate)
    .map(serializeBooking)
    .sort((a, b) => {
      if (!a.show || !b.show) return 0;
      if (a.show.date !== b.show.date) return a.show.date < b.show.date ? -1 : 1;
      return a.show.start_time < b.show.start_time ? -1 : 1;
    });

  res.status(200).json(results);
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

  const rows = ((data ?? []) as unknown as BookingRow[]).filter((row) => row.shows?.venues);

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

async function venueNamesByProducerIds(producerIds: string[]): Promise<Record<string, string>> {
  if (producerIds.length === 0) {
    return {};
  }

  const { data } = await supabaseAdmin
    .from('venues')
    .select('owner_id, name')
    .in('owner_id', producerIds);

  const map: Record<string, string> = {};
  (data ?? []).forEach((v: { owner_id: string; name: string }) => {
    map[v.owner_id] = v.name;
  });
  return map;
}

app.post('/api/spots', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const { date, start_time, end_time, spot_type, total_spots, price } = body;

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
  if (spot_type !== 'busking' && spot_type !== 'non_busking') {
    res.status(400).json({ error: 'spot_type must be busking or non_busking' });
    return;
  }
  if (typeof total_spots !== 'number' || !Number.isInteger(total_spots) || total_spots <= 0 || total_spots > 100) {
    res.status(400).json({ error: 'total_spots must be an integer between 1 and 100' });
    return;
  }
  let normalizedPrice: number | null = null;
  if (price !== undefined && price !== null && price !== '') {
    if (typeof price !== 'number' || price < 0) {
      res.status(400).json({ error: 'price must be a non-negative number' });
      return;
    }
    normalizedPrice = price;
  }

  const { data, error } = await supabaseAdmin
    .from('spots')
    .insert({
      venue_producer_id: userId,
      date,
      start_time,
      end_time,
      spot_type,
      total_spots,
      available_spots: total_spots,
      price: normalizedPrice,
    })
    .select(SPOT_SELECT)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data);
});

app.get('/api/spots/mine', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;

  const { data, error } = await supabaseAdmin
    .from('spots')
    .select(SPOT_SELECT)
    .eq('venue_producer_id', userId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json(data ?? []);
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

app.post('/api/spots/:id/cancel', requireUser, requireRole('venue_producer'), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const message = typeof req.body?.message === 'string' ? req.body.message : undefined;

  const { data, error } = await supabaseAdmin.rpc('cancel_spot', {
    p_spot_id: id,
    p_venue_producer_id: userId,
    p_message: message,
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
    .select('id, spot_id, comedian_id, status, venue_message, requested_at, decided_at')
    .eq('spot_id', id)
    .order('requested_at', { ascending: true });

  if (requestsError) {
    res.status(500).json({ error: requestsError.message });
    return;
  }

  const comedianIds = (requests ?? []).map((r) => r.comedian_id);
  let comedianNames: Record<string, string> = {};
  if (comedianIds.length > 0) {
    const { data: comedians } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .in('id', comedianIds);
    (comedians ?? []).forEach((c: { id: string; name: string }) => {
      comedianNames[c.id] = c.name;
    });
  }

  const enriched = (requests ?? []).map((r) => ({ ...r, comedian_name: comedianNames[r.comedian_id] }));

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

  const { data, error } = await supabaseAdmin.rpc('accept_spot_request', {
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

  const { data: requests, error } = await supabaseAdmin
    .from('spot_requests')
    .select(`id, spot_id, comedian_id, status, venue_message, requested_at, decided_at, spots:spot_id(${SPOT_SELECT})`)
    .eq('comedian_id', userId)
    .order('requested_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  type RequestRow = {
    id: string;
    spot_id: string;
    comedian_id: string;
    status: string;
    venue_message: string | null;
    requested_at: string;
    decided_at: string | null;
    spots: Record<string, unknown> & { venue_producer_id: string };
  };

  const rows = (requests ?? []) as unknown as RequestRow[];
  const producerIds = rows.map((r) => r.spots?.venue_producer_id).filter(Boolean);
  const venueNames = await venueNamesByProducerIds(producerIds);

  const result = rows.map((r) => ({
    id: r.id,
    spot_id: r.spot_id,
    comedian_id: r.comedian_id,
    status: r.status,
    venue_message: r.venue_message,
    requested_at: r.requested_at,
    decided_at: r.decided_at,
    spot: r.spots,
    venue_name: venueNames[r.spots?.venue_producer_id] ?? 'Venue',
  }));

  res.status(200).json(result);
});

app.listen(PORT, () => {
  console.log('OpenMic API running at http://localhost:' + PORT);
});
