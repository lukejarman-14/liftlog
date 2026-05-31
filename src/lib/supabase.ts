import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = !!(url && key);

// Authenticated client — carries the signed-in user's JWT for row-level operations.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key)
  : null;

// Public (anon-role) client — never carries a user JWT.
// Used for queries that must read across user rows (e.g. referral code lookup)
// where the RLS policy grants anon-read but restricts authenticated reads to own rows.
// storageKey is distinct from the main client to suppress the "Multiple GoTrueClient
// instances" warning — this client never persists a session so the key is never written.
export const supabasePublic: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-vf-public',
      },
    })
  : null;
