-- Seed Data - OpenMic Booking Platform
-- Run after rls.sql
-- Uses DO block for referential integrity

DO $$
DECLARE
  v1 uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid();
  v3 uuid := gen_random_uuid();
  v4 uuid := gen_random_uuid();
  v5 uuid := gen_random_uuid();
  v6 uuid := gen_random_uuid();
  v7 uuid := gen_random_uuid();
  v8 uuid := gen_random_uuid();
  v9 uuid := gen_random_uuid();
  v10 uuid := gen_random_uuid();
BEGIN
  INSERT INTO venues (
    id, name, address, city, state,
    country, photos, description,
    verified, admin_approved, is_active
  ) VALUES
    (v1, 'The Punchline Parlour', 'E-14, Inner Circle, Connaught Place, New Delhi 110001', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-1/600/400'], 'A polished basement room with quick crowds and crisp acoustics for punch-heavy sets.', true, true, true),
    (v2, 'Hauz Laugh Social', '17, 2nd Floor, Hauz Khas Village, New Delhi 110016', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-2/600/400'], 'This rooftop room draws energetic late-night audiences that love interactive stand-up.', true, true, true),
    (v3, 'Mic & Masala Cafe', 'A-92, Central Market Road, Lajpat Nagar II, New Delhi 110024', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-3/600/400'], 'A friendly neighborhood cafe stage known for supportive first-time open mic listeners.', true, true, true),
    (v4, 'North Campus Chuckles', '39, Bungalow Road, Kamla Nagar, New Delhi 110007', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-4/600/400'], 'A high-energy student hotspot where fast-paced sets and crowd banter work well.', true, true, true),
    (v5, 'Shahpur Jat Standup Room', '116, 3rd Floor, Shahpur Jat, Siri Fort, New Delhi 110049', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-5/600/400'], 'An intimate low-light room that suits experimental bits and nuanced storytelling.', true, true, true),
    (v6, 'Green Park Giggles Annex', 'C-12, Main Market, Malviya Nagar, New Delhi 110017', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-6/600/400'], 'A warm cafe-stage hybrid with steady neighborhood audiences across weeknights.', true, true, true),
    (v7, 'Kunj Comedy Courtyard', '12, Nelson Mandela Marg, Vasant Kunj, New Delhi 110070', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-7/600/400'], 'A spacious courtyard venue with relaxed seating and strong weekend turnout.', true, true, true),
    (v8, 'Saket Side Splitters Cafe', 'M-58, Ground Floor, Saket, New Delhi 110017', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-8/600/400'], 'A modern cafe room where observational material lands well with mixed-age crowds.', true, true, true),
    (v9, 'Punjabi Bagh Punch House', '24, Club Road, Punjabi Bagh West, New Delhi 110026', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-9/600/400'], 'A lively west Delhi space built for high-tempo sets and confident stage presence.', true, true, true),
    (v10, 'Dwarka Laugh Loft', 'Plot 8, Sector 12 Market, Dwarka, New Delhi 110078', 'Delhi', 'Delhi', 'India', ARRAY['https://picsum.photos/seed/venue-10/600/400'], 'A clean acoustic loft that balances newcomer spots with polished closing acts.', true, true, true);

  INSERT INTO shows (
    venue_id, date, start_time, end_time,
    spot_type, total_spots,
    available_spots, charge
  ) VALUES
    (v1, CURRENT_DATE + 0, '20:00', '21:30', 'busking', 10, 2, 0),
    (v1, CURRENT_DATE + 0, '20:30', '22:00', 'non_busking', 16, 6, 300),
    (v1, CURRENT_DATE + 3, '22:30', '23:59', 'non_busking', 12, 1, 500),
    (v2, CURRENT_DATE + 0, '21:00', '22:30', 'busking', 14, 4, 0),
    (v2, CURRENT_DATE + 2, '21:00', '22:30', 'non_busking', 18, 9, 500),
    (v2, CURRENT_DATE + 8, '22:30', '23:59', 'busking', 8, 2, 200),
    (v3, CURRENT_DATE + 1, '20:00', '21:30', 'busking', 11, 5, 0),
    (v3, CURRENT_DATE + 4, '20:00', '21:30', 'non_busking', 12, 3, 200),
    (v3, CURRENT_DATE + 7, '21:00', '22:30', 'busking', 10, 1, 300),
    (v4, CURRENT_DATE + 1, '20:30', '22:00', 'non_busking', 20, 12, 300),
    (v4, CURRENT_DATE + 6, '20:00', '21:30', 'busking', 15, 2, 0),
    (v4, CURRENT_DATE + 10, '22:30', '23:59', 'non_busking', 9, 4, 500),
    (v5, CURRENT_DATE + 0, '22:00', '23:30', 'busking', 8, 3, 0),
    (v5, CURRENT_DATE + 3, '21:00', '22:30', 'non_busking', 13, 6, 300),
    (v5, CURRENT_DATE + 9, '22:30', '23:59', 'busking', 10, 2, 200),
    (v6, CURRENT_DATE + 2, '20:00', '21:30', 'non_busking', 14, 8, 200),
    (v6, CURRENT_DATE + 13, '20:00', '21:30', 'busking', 12, 1, 0),
    (v7, CURRENT_DATE + 1, '20:00', '21:30', 'non_busking', 16, 7, 500),
    (v7, CURRENT_DATE + 7, '21:00', '22:30', 'busking', 11, 5, 300),
    (v8, CURRENT_DATE + 3, '20:00', '21:30', 'busking', 13, 6, 200),
    (v8, CURRENT_DATE + 12, '22:30', '23:59', 'non_busking', 9, 2, 500),
    (v9, CURRENT_DATE + 4, '20:00', '21:30', 'non_busking', 18, 10, 300),
    (v9, CURRENT_DATE + 8, '21:00', '22:30', 'busking', 10, 1, 0),
    (v10, CURRENT_DATE + 5, '20:00', '21:30', 'busking', 12, 4, 200),
    (v10, CURRENT_DATE + 9, '20:00', '21:30', 'non_busking', 14, 3, 500);
END $$;
