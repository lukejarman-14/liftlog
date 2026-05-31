/**
 * Referral system for Vector Football.
 *
 * Referrer:  gets +14 days added to premium on next app boot
 * Referred:  gets 21-day trial instead of 14
 */

import { supabase, supabasePublic } from './supabase';

const REFERRAL_TRIAL_MS = 21 * 24 * 60 * 60 * 1000;   // 21 days
const REFERRER_REWARD_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days

/** Generate a deterministic referral code from a user ID. */
export function generateReferralCode(userId: string): string {
  return 'VF' + userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Register the user's referral code in Supabase (idempotent). */
export async function registerReferralCode(userId: string): Promise<string> {
  const code = generateReferralCode(userId);
  if (!supabase) return code;
  const { error } = await supabase
    .from('referral_codes')
    .upsert({ code, user_id: userId }, { onConflict: 'user_id' });
  // Surface the error so callers know the code isn't in the DB yet.
  // Without this, the code appears in the UI but redemptions silently fail.
  if (error) throw new Error(`Failed to register referral code: ${error.message}`);
  return code;
}

export type ReferralResult =
  | { success: true; trialMs: number }
  | { success: false; reason: 'invalid' | 'self' | 'already_used' | 'error' };

/**
 * Redeem a referral code for a new user.
 * Returns the trial duration in ms (21 days) on success.
 */
export async function redeemReferralCode(
  rawCode: string,
  referredUserId: string,
): Promise<ReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, reason: 'invalid' };
  if (!referredUserId) return { success: false, reason: 'error' };
  if (!supabase) return { success: false, reason: 'error' };

  try {
    // Use the anon client — RLS on the authenticated client only returns the
    // current user's own row, which makes foreign codes appear invalid.
    // Guard explicitly: falling back to the authenticated client would silently
    // make all foreign codes look invalid due to RLS.
    if (!supabasePublic) return { success: false, reason: 'error' };
    const { data: codeRow, error } = await supabasePublic
      .from('referral_codes')
      .select('user_id')
      .eq('code', code)
      .single();

    if (error || !codeRow) return { success: false, reason: 'invalid' };
    if (codeRow.user_id === referredUserId) return { success: false, reason: 'self' };

    // Check not already used by this user
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', referredUserId)
      .limit(1);

    if (existing && existing.length > 0) return { success: false, reason: 'already_used' };

    // Log the referral — reward_applied starts false (applied on referrer's next boot)
    const { error: insertError } = await supabase.from('referrals').insert({
      referral_code: code,
      referrer_user_id: codeRow.user_id,
      referred_user_id: referredUserId,
      reward_applied: false,
    });

    // Unique constraint violation (23505) means a concurrent request already inserted this row
    if (insertError) {
      if (insertError.code === '23505') return { success: false, reason: 'already_used' };
      return { success: false, reason: 'error' };
    }

    return { success: true, trialMs: REFERRAL_TRIAL_MS };
  } catch {
    return { success: false, reason: 'error' };
  }
}

/** Claim unapplied referral rewards and return total ms to add to premium. */
export async function claimReferralRewards(userId: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data } = await supabase
      .from('referrals')
      .update({ reward_applied: true })
      .eq('referrer_user_id', userId)
      .eq('reward_applied', false)
      .select('id');

    if (!data || data.length === 0) return 0;
    return data.length * REFERRER_REWARD_MS;
  } catch {
    return 0;
  }
}
