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
  return 'VF' + userId.replace(/-/g, '').slice(0, 6).toUpperCase();
}

/** Register the user's referral code in Supabase (idempotent). */
export async function registerReferralCode(userId: string): Promise<string> {
  const code = generateReferralCode(userId);
  if (!supabase) return code;
  await supabase
    .from('referral_codes')
    .upsert({ code, user_id: userId }, { onConflict: 'code' });
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
  if (!code || !supabase) return { success: false, reason: 'error' };

  try {
    // Look up who owns this code using the anon-role client (no user JWT).
    // The authenticated client would only return the current user's own row due to RLS,
    // causing valid codes owned by other users to appear as 'invalid'.
    const publicClient = supabasePublic ?? supabase;
    const { data: codeRow, error } = await publicClient
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
    await supabase.from('referrals').insert({
      referral_code: code,
      referrer_user_id: codeRow.user_id,
      referred_user_id: referredUserId,
      reward_applied: false,
    });

    return { success: true, trialMs: REFERRAL_TRIAL_MS };
  } catch {
    return { success: false, reason: 'error' };
  }
}

/**
 * Check for unapplied referral rewards for this user and return total ms to add.
 * Marks them as applied immediately.
 */
export async function claimReferralRewards(userId: string): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_user_id', userId)
      .eq('reward_applied', false);

    if (!data || data.length === 0) return 0;

    // Mark all as applied
    const ids = data.map(r => r.id);
    await supabase
      .from('referrals')
      .update({ reward_applied: true })
      .in('id', ids);

    return data.length * REFERRER_REWARD_MS;
  } catch {
    return 0;
  }
}
