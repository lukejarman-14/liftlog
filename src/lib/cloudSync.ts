/**
 * Cloud auth + data sync via Supabase.
 * All app data is stored in a single JSONB column in user_data table.
 * Falls back to local-only mode if Supabase is not configured.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { STORAGE_KEYS } from './dataSync';


function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    try { data[key] = raw ? JSON.parse(raw) : null; }
    catch { data[key] = null; }
  }
  return data;
}

function restoreAllData(data: Record<string, unknown>) {
  for (const key of STORAGE_KEYS) {
    const val = data[key];
    if (val !== undefined && val !== null) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  }
}


/** Register a new user with Supabase. */
export async function cloudSignUp(email: string, password: string): Promise<string | null> {
  if (!supabase) throw new Error('not_configured');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user?.id ?? null;
}

/** Sign in with Supabase. Returns the user ID on success. */
export async function cloudSignIn(email: string, password: string): Promise<string> {
  if (!supabase) throw new Error('not_configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user.id;
}

/** Sign out from Supabase. */
export async function cloudSignOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Permanently delete the current user's account and all their data from Supabase. */
export async function cloudDeleteAccount(): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { error: dataError } = await supabase.from('user_data').delete().eq('id', user.id);
    if (dataError) throw new Error(`Failed to delete user data: ${dataError.message}`);
    const { error: authError } = await supabase.rpc('delete_user');
    if (authError) throw new Error(`Failed to delete auth account: ${authError.message}`);
  }
  await supabase.auth.signOut();
}

/** Send a password reset email to the user. */
export async function cloudResetPassword(email: string): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  const origin = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/`,
  });
  if (error) throw error;
}

/** Update the current user's password (used after clicking reset link). */
export async function cloudUpdatePassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Check if a Supabase session already exists (e.g. after page reload). */
export async function getExistingSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}


/** Push all localStorage data to Supabase for this user. */
export async function cloudSaveData(userId: string): Promise<void> {
  if (!supabase) return;
  const appData = collectAllData();
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, app_data: appData, updated_at: new Date().toISOString() });
  if (error) {
    console.warn('[CloudSync] Save failed — will retry on next sync:', error.message);
  }
}

/** Pull data from Supabase and write to localStorage. Returns true if data was found. */
export async function cloudLoadData(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('user_data')
    .select('app_data')
    .eq('id', userId)
    .single();
  if (error || !data?.app_data) return false;
  const appData = data.app_data as Record<string, unknown>;
  restoreAllData(appData);
  return true;
}

export { isSupabaseConfigured };
