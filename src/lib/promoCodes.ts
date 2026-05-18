/**
 * Promo code redemption.
 * Codes are stored in Supabase `promo_codes` table.
 * Each code grants 30 days of premium access.
 * A redeemed code is stored in localStorage to prevent re-use on the same device.
 */

import { supabase } from './supabase';

const REDEEMED_KEY = 'vf_redeemed_codes';
const PROMO_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getRedeemedCodes(): string[] {
  try {
    const raw = localStorage.getItem(REDEEMED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markRedeemed(code: string) {
  const existing = getRedeemedCodes();
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

  // Prevent re-use on same device
  if (getRedeemedCodes().includes(code)) {
    return { success: false, reason: 'already_used' };
  }

  if (!supabase) return { success: false, reason: 'error' };

  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('code, active')
      .eq('code', code)
      .single();

    if (error || !data) return { success: false, reason: 'invalid' };
    if (!data.active) return { success: false, reason: 'inactive' };

    const expiresAt = Date.now() + PROMO_DURATION_MS;
    markRedeemed(code);
    return { success: true, expiresAt };
  } catch {
    return { success: false, reason: 'error' };
  }
}
