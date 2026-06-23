import { supabase, isSupabaseConfigured } from './supabase';
import { STORAGE_KEYS } from './dataSync';
import { getCaptchaToken } from './hcaptcha';
import { captureError } from './sentry';
import type { Provider } from '@supabase/supabase-js';


// Keys whose values are authoritative on the server only (written by webhooks/RevenueCat).
// We never upload these from the client — a localStorage edit must never be able to
// overwrite the server's record.  cloudLoadData restores them correctly on every boot.
const SERVER_MANAGED_KEYS = new Set<string>(['vf_premium']);

// ---------------------------------------------------------------------------
// Shared-device account isolation
// ---------------------------------------------------------------------------
// localStorage is shared by every account used on this browser/device. Without a
// guard, account B can inherit or overwrite account A's profile, premium, and
// squad state (and a stale blob can be uploaded under B's id before B's cloud
// data loads). We tag local data with the owning user id: we wipe on a mismatched
// LOAD (sign-in) and refuse a mismatched SAVE — never wiping a fresh signup.
const DATA_OWNER_KEY = 'vf_data_owner';

/** Remove all app data from localStorage (leaves the Supabase session intact). */
export function clearLocalAppData(): void {
  for (const key of STORAGE_KEYS) localStorage.removeItem(key);
  localStorage.removeItem('vf_pending_team_code');
}

/** Logout cleanup for a possibly-shared device: wipe app data AND the owner tag. */
export function clearDataOwnership(): void {
  clearLocalAppData();
  localStorage.removeItem(DATA_OWNER_KEY);
}

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
    let val = data[key];
    if (val === undefined || val === null) continue;
    // Defensively strip any legacy password hash a pre-fix cloud row may still
    // carry, so the device-only secret never repopulates onto a device.
    if (key === 'vf_user_profile' && typeof val === 'object') {
      const { passwordHash: _omit, ...rest } = val as Record<string, unknown>;
      void _omit;
      val = rest;
    }
    localStorage.setItem(key, JSON.stringify(val));
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

export type OAuthProvider = Extract<Provider, 'apple' | 'google'>;

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
  // Pin the confirmation-link target explicitly (same origin the password-reset
  // flow uses) so a drifting dashboard Site URL can't silently break confirmation.
  const origin = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken, emailRedirectTo: `${origin}/` },
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

/** Start Apple / Google OAuth through Supabase. The browser redirects away. */
export async function cloudSignInWithOAuth(provider: OAuthProvider): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  const origin = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/`,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) throw error;
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
  if (!user) return;
  // The SECURITY DEFINER RPC deletes every user-owned application row and then
  // removes auth.users. Keep this as the single server-side delete path so the
  // client never reports success after only a partial cleanup.
  const { error: authError } = await supabase.rpc('delete_user');
  if (authError) throw new Error(`Failed to delete account: ${authError.message}`);
  // Sign out ONLY after a successful deletion. On failure we throw above WITHOUT
  // signing out, so the user stays logged in and can retry — fail-closed, and
  // never leaves them believing a failed deletion succeeded.
  await supabase.auth.signOut();
}

/** Re-send the email confirmation link to the given address. */
export async function cloudResendConfirmation(email: string): Promise<void> {
  if (!supabase) throw new Error('not_configured');
  // captchaToken is required when Supabase CAPTCHA is enabled; ignored when off.
  const captchaToken = await getCaptchaToken();
  const origin = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { captchaToken, emailRedirectTo: `${origin}/` },
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

/** Re-authenticate with the current password before a sensitive change (e.g. a
 *  password update from Profile). Returns true if the password is correct. An
 *  active session alone must not be enough to set a new password. */
export async function cloudVerifyPassword(email: string, password: string): Promise<boolean> {
  if (!supabase) return true; // not configured — the local hash check governs
  // CAPTCHA enforcement is on for signInWithPassword, so pass a fresh token.
  const captchaToken = await getCaptchaToken();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
  return !error;
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
export async function cloudSaveData(userId: string): Promise<boolean> {
  if (!supabase) return false;
  // Never upload one account's local data under another account's id. If the
  // local data is owned by a different user (stale shared-device state), abort
  // rather than contaminating this user's cloud row. (We do NOT wipe here — that
  // would risk a fresh signup's just-entered profile; the LOAD path wipes.)
  const owner = localStorage.getItem(DATA_OWNER_KEY);
  if (owner && owner !== userId) {
    if (import.meta.env.DEV) console.warn('[CloudSync] save aborted — local data belongs to a different account');
    return false;
  }
  localStorage.setItem(DATA_OWNER_KEY, userId);
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
  if (error) {
    // Report in PRODUCTION too (was dev-only console) so silent sync failures are
    // visible in Sentry. Returns false so callers can react instead of assuming success.
    captureError(error, { context: 'cloudSaveData', userId });
    return false;
  }
  return true;
}

/** Pull data from Supabase and write to localStorage. Returns true if data was found. */
export async function cloudLoadData(userId: string): Promise<boolean> {
  if (!supabase) return false;
  // Shared-device guard: if local data belongs to a different account, wipe it
  // BEFORE loading (and before any early-return) so nothing from the previous
  // user survives into this session — even if this user has no cloud row yet.
  const owner = localStorage.getItem(DATA_OWNER_KEY);
  if (owner && owner !== userId) clearLocalAppData();
  localStorage.setItem(DATA_OWNER_KEY, userId);
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
