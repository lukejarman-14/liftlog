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

export type RedeemResult =
  | { success: true; expiresAt: number }
  | { success: false; reason: 'invalid' | 'already_used' | 'inactive' | 'error' | 'not_authenticated' };

/** Check a promo code and return the expiry timestamp if valid. */
export async function redeemPromoCode(rawCode: string): Promise<RedeemResult> {
  if (isPromoRateLimited()) return { success: false, reason: 'error' };
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, reason: 'invalid' };

  if (!supabase) return { success: false, reason: 'error' };

  try {
    const { data: promoRow, error: promoError } = await supabase
      .from('promo_codes')
      .select('code, active')
      .eq('code', code)
      .single();

    if (promoError || !promoRow) return { success: false, reason: 'invalid' };
    if (!promoRow.active) return { success: false, reason: 'inactive' };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, reason: 'not_authenticated' };

    // Local cache check is scoped to this user — done after getUser() so we
    // have the user ID. Avoids a false "already used" for a different account
    // on the same device.
    if (getLocalRedeemedCodes(user.id).includes(code)) {
      return { success: false, reason: 'already_used' };
    }

    // Destructure error so a network/RLS failure doesn't look like "not redeemed"
    const { data: existingRedemption, error: redemptionCheckError } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (redemptionCheckError) return { success: false, reason: 'error' };

    if (existingRedemption) {
      cacheRedeemedLocally(code, user.id);
      return { success: false, reason: 'already_used' };
    }

    const expiresAt = Date.now() + PROMO_DURATION_MS;
    const { error: insertError } = await supabase
      .from('promo_redemptions')
      .insert({ code, user_id: user.id, redeemed_at: new Date().toISOString() });

    if (insertError) {
      // 23505 = unique_violation — a concurrent request got there first.
      if (insertError.code === '23505') {
        cacheRedeemedLocally(code, user.id);
        return { success: false, reason: 'already_used' };
      }
      return { success: false, reason: 'error' };
    }

    cacheRedeemedLocally(code, user.id);
    return { success: true, expiresAt };
  } catch {
    return { success: false, reason: 'error' };
  }
}
