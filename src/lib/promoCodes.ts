// Promo code redemption — codes grant 30 days of premium.
// Redemptions are tracked in `promo_redemptions` (per-user) with a local
// localStorage cache as a fast first-check.

import { supabase } from './supabase';

const REDEEMED_KEY = 'vf_redeemed_codes';
const PROMO_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getLocalRedeemedCodes(): string[] {
  try {
    const raw = localStorage.getItem(REDEEMED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function cacheRedeemedLocally(code: string) {
  const existing = getLocalRedeemedCodes();
  if (!existing.includes(code)) {
    localStorage.setItem(REDEEMED_KEY, JSON.stringify([...existing, code]));
  }
}

export type RedeemResult =
  | { success: true; expiresAt: number }
  | { success: false; reason: 'invalid' | 'already_used' | 'inactive' | 'error' };

/** Check a promo code and return the expiry timestamp if valid. */
export async function redeemPromoCode(rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, reason: 'invalid' };

  if (getLocalRedeemedCodes().includes(code)) {
    return { success: false, reason: 'already_used' };
  }

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
    if (!user) return { success: false, reason: 'error' };

    const { data: existingRedemption } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRedemption) {
      cacheRedeemedLocally(code);
      return { success: false, reason: 'already_used' };
    }

    const expiresAt = Date.now() + PROMO_DURATION_MS;
    const { error: insertError } = await supabase
      .from('promo_redemptions')
      .insert({ code, user_id: user.id, redeemed_at: new Date().toISOString() });

    if (insertError) {
      // 23505 = unique_violation — a concurrent request got there first.
      if (insertError.code === '23505') {
        cacheRedeemedLocally(code);
        return { success: false, reason: 'already_used' };
      }
      return { success: false, reason: 'error' };
    }

    cacheRedeemedLocally(code);
    return { success: true, expiresAt };
  } catch {
    return { success: false, reason: 'error' };
  }
}
