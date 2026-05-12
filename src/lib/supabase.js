// lib/supabase.js
// ─────────────────────────────────────────────────────────────────
// Supabase client. Vite-style env vars by default.
// For Next.js: change to `process.env.NEXT_PUBLIC_*` and rename
// the keys in .env to NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy .env.example to .env and fill in your project URL + anon key.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
