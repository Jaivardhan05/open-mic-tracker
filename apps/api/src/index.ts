import cors from 'cors';
import express from 'express';

import type { Request, Response } from 'express';
import { MOCK_SHOWS, MOCK_VENUES } from './data/mockData.js';
import { filterShows, ShowFilters } from './utils/filterShows';

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const ALLOWED_ORIGIN = 'http://localhost:3000';

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
  })
);
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/venues', (req: Request, res: Response) => {
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;

  if (!city) {
    res.status(200).json(MOCK_VENUES);
    return;
  }

  const filteredVenues = MOCK_VENUES.filter((venue) => {
    return venue.city.toLowerCase() === city.toLowerCase();
  });

  res.status(200).json(filteredVenues);
});

app.get('/api/shows', (req: Request, res: Response) => {
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

  let filteredVenues = MOCK_VENUES;

  if (city) {
    filteredVenues = filteredVenues.filter((venue) => {
      return venue.city.toLowerCase() === city.toLowerCase();
    });
  }

  if (venue_name) {
    filteredVenues = filteredVenues.filter((venue) => {
      return venue.name.toLowerCase().includes(venue_name.toLowerCase());
    });
  }

  const venue_ids: string[] = filteredVenues.map((venue) => venue.id);

  const filters: ShowFilters = {};
  if (date) {
    filters.date = date;
  }
  if (spot_type) {
    filters.spot_type = spot_type as 'busking' | 'non_busking';
  }
  if (after_time) {
    filters.after_time = after_time;
  }
  if (before_time) {
    filters.before_time = before_time;
  }

  if (city || venue_name) {
    filters.venue_ids = venue_ids;
  }

  const results = filterShows(MOCK_SHOWS, filters);
  res.status(200).json(results);
});

app.listen(PORT, () => {
  console.log('OpenMic API running at http://localhost:' + PORT);
});
