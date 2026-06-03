/**
 * premiumUtils — pure functions extracted from usePremium for testability.
 *
 * These are the core access-gate computations. Keeping them as pure functions
 * means they can be unit-tested without React or localStorage setup, and the
 * hook just delegates to them.
 */

import type { PremiumStatus } from '../types';

export const TRIAL_DAYS = 30;
export const MS_PER_DAY = 86_400_000;

/**
 * Returns true if the user currently has access (paid subscription OR active trial).
 * Pass `now` in tests to control the clock.
 */
export function computeHasAccess(status: PremiumStatus, now = Date.now()): boolean {
  if (status.isPremium) {
    // Paid — but check if a timed subscription has lapsed
    if (status.expiresAt && status.expiresAt < now) return false;
    return true;
  }
  // Non-premium: check expiresAt first so referral/promo grants work even
  // for users who never explicitly started a trial (trialStartedAt is null).
  if (status.expiresAt) return status.expiresAt > now;
  if (!status.trialStartedAt) return false;
  return now - status.trialStartedAt < TRIAL_DAYS * MS_PER_DAY;
}

/**
 * Returns days remaining in the trial, or null if not in a trial or already premium.
 * Returns 0 (not negative) when the trial has just expired.
 */
export function computeTrialDaysLeft(status: PremiumStatus, now = Date.now()): number | null {
  if (status.isPremium || !status.trialStartedAt) return null;
  const expiryTs = status.expiresAt ?? (status.trialStartedAt + TRIAL_DAYS * MS_PER_DAY);
  const remaining = Math.ceil((expiryTs - now) / MS_PER_DAY);
  return remaining > 0 ? remaining : 0;
}
