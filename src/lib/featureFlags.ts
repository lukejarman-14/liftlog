/**
 * Feature flags — toggle features without deleting their code.
 */

// Referrals are OFF during the pre-season period (until ~1 Aug 2026). Every user
// already gets the 30-day free trial in that window, so a referral (21 days) is
// pointless — and actually worse than just signing up. All referral code is kept
// intact; flip this to `true` once the paywall is live AND the reward amounts
// (referred / referrer days) have been re-decided so they beat the standard trial.
// Typed as boolean (not the literal `false`) so toggling it doesn't make
// TypeScript treat the gated branches as unreachable / dead code.
export const REFERRALS_ENABLED: boolean = false;
