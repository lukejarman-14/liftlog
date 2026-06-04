import { supabase, isSupabaseConfigured } from './supabase';
import { STORAGE_KEYS } from './dataSync';
import { getCaptchaToken } from './hcaptcha';


// Keys whose values are authoritative on the server only (written by webhooks/RevenueCat).
// We never upload these from the client — a localStorage edit must never be able to
// overwrite the server's record.  cloudLoadData restores them correctly on every boot.
const SERVER_MANAGED_KEYS = new Set<string>(['vf_premium']);

function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of STORAGE_KEYS) {
    if (SERVER_MANAGED_KEYS.has(key)) continue; // never upload — managed by webhooks
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
  window.dispatchEvent(new CustomEvent('vf-cloud-restored'));
}


/** Register a new user with Supabase.
 *  If Supabase returns a session immediately (email confirmation disabled),
 *  the session is persisted so the user never hits the Login screen.
 *  If confirmation is required, returns the user ID but no session —
 *  the cloudUnlinked banner will prompt the user to confirm. */
export type SignUpResult = {
  userId: string | null;
  /** true when Supabase requires the user to click a confirmation email before a session is issued */
  needsEmailConfirmation: boolean;
};

/** Shared auth rate-limit guard — 5 attempts per 15 minutes per email.
 *  Throws 'too_many_attempts' if the limit is exceeded so callers can
 *  surface a friendly message without reaching Supabase's GoTrue. */
async function guardAuthRateLimit(email: string): Promise<void> {
  if (!supabase) return;
  const { data: allowed } = await supabase.rpc('check_auth_rate_limit', {
    p_identifier: email.toLowerCase().trim(),
    p_max_attempts: 5,
    p_window_minutes: 15,
  });
  if (allowed === false) {
    throw new Error('too_many_attempts');
  }
}

export async function cloudSignUp(email: string, password: string): Promise<SignUpResult> {
  if (!supabase) throw new Error('not_configured');
  await guardAuthRateLimit(email);
  // captchaToken is required when Supabase CAPTCHA is enabled; ignored when off.
  const captchaToken = await getCaptchaToken();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken },
  });
  if (error) throw error;
  // If email confirmation is disabled, Supabase returns a session immediately.
  // Set it explicitly so getSession() returns it on next load.
  if (data.session) {
    await supabase.auth.setSession(data.session);
  }
  return {
    userId: data.user?.id ?? null,
    needsEmailConfirmation: !data.session,
  };
}

/** Sign in with Supabase. Returns the user ID on success. */
export async function cloudSignIn(email: string, password: string): Promise<string> {
  if (!supabase) throw new Error('not_configured');
  await guardAuthRateLimit(email);
  // captchaToken is required when Supabase CAPTCHA is enabled; ignored when off.
  const captchaToken = await getCaptchaToken();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
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
  try {
    if (user) {
      // Auth must be deleted first — the RPC runs under the current session,
      // so the session needs to be valid when it executes.
      const { error: authError } = await supabase.rpc('delete_user');
      if (authError) throw new Error(`Failed to delete auth account: ${authError.message}`);
      // Clean up any orphaned app data (CASCADE should handle this, but be explicit).
      await supabase.from('user_data').delete().eq('id', user.id);
    }
  } finally {
    // Always sign out, even if deletion threw — the local session must not survive.
    await supabase.auth.signOut();
  }
}

/** Re-send the email confirmation link to the given address. */
export async function cloudResendConfirmation(email: string): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  // captchaToken is required when Supabase CAPTCHA is enabled; ignored when off.
  const captchaToken = await getCaptchaToken();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { captchaToken },
  });
  if (error) throw error;
}

/** Send a password reset email to the user. */
export async function cloudResetPassword(email: string): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  await guardAuthRateLimit(email);
  const origin = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  // captchaToken is required when Supabase CAPTCHA is enabled; ignored when off.
  const captchaToken = await getCaptchaToken();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/`,
    captchaToken,
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
  // Strip the local password hash before uploading — it's device-only.
  const profile = appData['vf_user_profile'];
  if (profile && typeof profile === 'object') {
    const safeProfile = { ...(profile as Record<string, unknown>) };
    delete safeProfile.passwordHash;
    appData['vf_user_profile'] = safeProfile;
  }
  const { error } = await supabase
    .from('user_data')
    .upsert({ id: userId, app_data: appData, updated_at: new Date().toISOString() });
  if (error && import.meta.env.DEV) {
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

  // Skip the write + event dispatch if nothing has changed — avoids unnecessary
  // re-renders across all useLocalStorage hooks when the same data is polled.
  let hasChanges = false;
  for (const key of STORAGE_KEYS) {
    const incoming = appData[key];
    if (incoming === undefined || incoming === null) continue;
    // Re-serialise both sides through JSON to normalise key ordering before comparing,
    // avoiding false "no changes" when the server returns a different key order.
    const local = localStorage.getItem(key);
    const incomingStr = JSON.stringify(JSON.parse(JSON.stringify(incoming)));
    let localStr: string | null = null;
    try {
      localStr = local ? JSON.stringify(JSON.parse(local)) : null;
    } catch {
      // Malformed local JSON — treat as changed so cloud data overwrites the corrupt value
      hasChanges = true;
      break;
    }
    if (localStr !== incomingStr) {
      hasChanges = true;
      break;
    }
  }
  if (!hasChanges) return true;

  restoreAllData(appData);
  return true;
}

export { isSupabaseConfigured };
