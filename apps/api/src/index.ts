import "dotenv/config";
import cors from 'cors';
import express from 'express';

import type { Request, Response } from 'express';
import { supabase, supabaseAdmin } from './lib/supabase.js';
import { processChat } from './services/llmService.js';

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
    .eq('is_active', true);

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
      'id, venue_id, date, start_time, end_time, spot_type, total_spots, available_spots, charge, venues!inner(id, name, city, admin_approved, is_active)'
    )
    .eq('is_cancelled', false)
    .eq('venues.admin_approved', true)
    .eq('venues.is_active', true)
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

app.post('/api/chat', async (req: Request, res: Response) => {
  const message = req.body?.message;

  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({
      error: 'message is required and must be a string',
    });
    return;
  }

  const result = await processChat(message);
  res.status(200).json(result);
});

app.get('/api/venues/:id', async (req: Request, res: Response) => {
  const id = req.params.id;

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, name, address, city, photos, description')
    .eq('id', id)
    .eq('admin_approved', true)
    .eq('is_active', true)
    .maybeSingle();

  if (venueError) {
    res.status(500).json({ error: venueError.message });
    return;
  }

  if (!venue) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

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

  res.status(200).json({ venue, shows: shows ?? [] });
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

app.listen(PORT, () => {
  console.log('OpenMic API running at http://localhost:' + PORT);
});
