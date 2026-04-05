import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment'
  );
}

// Public client - respects RLS
// Use for all public read queries
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Admin client - bypasses RLS
// Use ONLY for admin operations and
// atomic functions. Never expose to
// frontend or return in API responses.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
