// Promo code redemption — codes grant 30 days of premium.
// Redemptions are tracked in `promo_redemptions` (per-user) with a local
// localStorage cache as a fast first-check.

import { supabase } from './supabase';

const REDEEMED_KEY = 'vf_redeemed_codes';
const PROMO_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Client-side rate limit: max 5 attempts per 30 s.
// Defence-in-depth only — the real guard is server-side RLS + unique constraints.
const RATE_WINDOW_MS = 30_000;
const RATE_MAX = 5;
const promoAttemptTimestamps: number[] = [];

function isPromoRateLimited(): boolean {
  const now = Date.now();
  // Evict timestamps outside the current window
  while (promoAttemptTimestamps.length > 0 && promoAttemptTimestamps[0] < now - RATE_WINDOW_MS) {
    promoAttemptTimestamps.shift();
  }
  if (promoAttemptTimestamps.length >= RATE_MAX) return true;
  promoAttemptTimestamps.push(now);
  return false;
}

// Cache key is scoped per user so different accounts on the same device
// don't share "already redeemed" state.
function getLocalRedeemedCodes(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${REDEEMED_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function cacheRedeemedLocally(code: string, userId: string) {
  const existing = getLocalRedeemedCodes(userId);
  if (!existing.includes(code)) {
    localStorage.setItem(`${REDEEMED_KEY}:${userId}`, JSON.stringify([...existing, code]));
  }
}

export type RedeemReason =
  | 'invalid' | 'already_used' | 'inactive' | 'error'
  | 'not_authenticated' | 'email_unconfirmed' | 'rate_limited';

export type RedeemResult =
  | { success: true; expiresAt: number }
  | { success: false; reason: RedeemReason };

/**
 * Redeem a promo code.
 *
 * All validation, single-use enforcement and rate limiting now happen
 * server-side in the `redeem_promo_code` SECURITY DEFINER RPC (migration 010).
 * The client no longer reads `promo_codes` directly, so codes cannot be
 * enumerated. The local cache + client rate limit below are UX niceties only
 * (instant feedback, fewer round-trips) — they are NOT the security boundary.
 */
export async function redeemPromoCode(rawCode: string): Promise<RedeemResult> {
  if (isPromoRateLimited()) return { success: false, reason: 'rate_limited' };
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, reason: 'invalid' };
  if (!supabase) return { success: false, reason: 'error' };

  try {
    // Fast local "already used" short-circuit to avoid a needless round-trip.
    // Scoped per user so different accounts on the same device don't collide.
    const { data: { user } } = await supabase.auth.getUser();
    if (user && getLocalRedeemedCodes(user.id).includes(code)) {
      return { success: false, reason: 'already_used' };
    }

    // Server is authoritative: validates the code, enforces the rate limit,
    // requires a confirmed email, and records the redemption atomically.
    const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code });
    if (error || !data) return { success: false, reason: 'error' };

    const result = data as { success: boolean; reason?: RedeemReason; expires_at?: number };

    if (!result.success) {
      // Cache a server-confirmed "already used" so we short-circuit next time.
      if (result.reason === 'already_used' && user) cacheRedeemedLocally(code, user.id);
      return { success: false, reason: result.reason ?? 'error' };
    }

    if (user) cacheRedeemedLocally(code, user.id);
    // Prefer the server's expiry; fall back to a local 30-day window.
    const expiresAt = typeof result.expires_at === 'number'
      ? result.expires_at
      : Date.now() + PROMO_DURATION_MS;
    return { success: true, expiresAt };
  } catch {
    return { success: false, reason: 'error' };
  }
}
