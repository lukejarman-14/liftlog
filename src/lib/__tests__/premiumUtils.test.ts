/**
 * Premium access logic — unit tests.
 *
 * Tests computeHasAccess and computeTrialDaysLeft from premiumUtils.ts.
 * These are the exact same functions the usePremium hook uses, so regressions
 * here mean users could be locked out or granted access they shouldn't have.
 */

import { describe, it, expect } from 'vitest';
import { computeHasAccess, computeTrialDaysLeft, TRIAL_DAYS, MS_PER_DAY } from '../premiumUtils';
import type { PremiumStatus } from '../../types';

const NOW = 1_700_000_000_000; // fixed timestamp — tests don't depend on real clock

// ─── computeHasAccess ────────────────────────────────────────────────────────

describe('computeHasAccess', () => {
  it('free user with no trial started → no access', () => {
    const status: PremiumStatus = { isPremium: false };
    expect(computeHasAccess(status, NOW)).toBe(false);
  });

  it('free user mid-trial → access', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - 10 * MS_PER_DAY, // 10 days in
    };
    expect(computeHasAccess(status, NOW)).toBe(true);
  });

  it('free user on final day of trial → access', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - (TRIAL_DAYS - 1) * MS_PER_DAY,
    };
    expect(computeHasAccess(status, NOW)).toBe(true);
  });

  it('free user with expired trial → no access', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - (TRIAL_DAYS + 1) * MS_PER_DAY, // 1 day past expiry
    };
    expect(computeHasAccess(status, NOW)).toBe(false);
  });

  it('premium user with no expiry (lifetime) → always access', () => {
    const status: PremiumStatus = { isPremium: true, plan: 'lifetime' };
    expect(computeHasAccess(status, NOW)).toBe(true);
    // Still true far into the future
    expect(computeHasAccess(status, NOW + 365 * MS_PER_DAY * 10)).toBe(true);
  });

  it('premium user with future subscription expiry → access', () => {
    const status: PremiumStatus = {
      isPremium: true,
      plan: 'monthly',
      expiresAt: NOW + 15 * MS_PER_DAY,
    };
    expect(computeHasAccess(status, NOW)).toBe(true);
  });

  it('premium user with lapsed subscription → no access', () => {
    const status: PremiumStatus = {
      isPremium: true,
      plan: 'monthly',
      expiresAt: NOW - 1, // expired 1ms ago
    };
    expect(computeHasAccess(status, NOW)).toBe(false);
  });

  it('non-premium user with future expiresAt (referral/promo grant) → access', () => {
    // Referral rewards set expiresAt without setting isPremium
    const status: PremiumStatus = {
      isPremium: false,
      expiresAt: NOW + 21 * MS_PER_DAY,
    };
    expect(computeHasAccess(status, NOW)).toBe(true);
  });

  it('non-premium user with past expiresAt (referral/promo expired) → no access', () => {
    const status: PremiumStatus = {
      isPremium: false,
      expiresAt: NOW - 1,
    };
    expect(computeHasAccess(status, NOW)).toBe(false);
  });

  it('expiresAt takes priority over trialStartedAt for grant access', () => {
    // expiresAt is still live but trial clock would also be expired — expiresAt wins
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - (TRIAL_DAYS + 5) * MS_PER_DAY, // trial expired
      expiresAt: NOW + 5 * MS_PER_DAY, // but referral grant is still live
    };
    expect(computeHasAccess(status, NOW)).toBe(true);
  });
});

// ─── computeTrialDaysLeft ────────────────────────────────────────────────────

describe('computeTrialDaysLeft', () => {
  it('premium user → null (not in trial)', () => {
    const status: PremiumStatus = { isPremium: true, plan: 'yearly' };
    expect(computeTrialDaysLeft(status, NOW)).toBeNull();
  });

  it('no trial started → null', () => {
    const status: PremiumStatus = { isPremium: false };
    expect(computeTrialDaysLeft(status, NOW)).toBeNull();
  });

  it('10 days into 30-day trial → 20 days left', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - 10 * MS_PER_DAY,
    };
    expect(computeTrialDaysLeft(status, NOW)).toBe(20);
  });

  it('29 days in → 1 day left', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - 29 * MS_PER_DAY,
    };
    expect(computeTrialDaysLeft(status, NOW)).toBe(1);
  });

  it('trial exactly expired → 0, not negative', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - TRIAL_DAYS * MS_PER_DAY,
    };
    expect(computeTrialDaysLeft(status, NOW)).toBe(0);
  });

  it('trial long expired → 0, not negative', () => {
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: NOW - (TRIAL_DAYS + 100) * MS_PER_DAY,
    };
    expect(computeTrialDaysLeft(status, NOW)).toBe(0);
  });

  it('custom expiresAt (referral extended) gives more time than standard trial remaining', () => {
    // Trial started 25 days ago. Without extension: 5 days left (30 - 25).
    // Referral adds 21 days to the standard expiry → 26 days from now.
    const trialStart = NOW - 25 * MS_PER_DAY;
    const standardExpiry = trialStart + TRIAL_DAYS * MS_PER_DAY; // NOW + 5 days
    const extendedExpiry = standardExpiry + 21 * MS_PER_DAY;     // NOW + 26 days
    const status: PremiumStatus = {
      isPremium: false,
      trialStartedAt: trialStart,
      expiresAt: extendedExpiry,
    };
    const daysLeft = computeTrialDaysLeft(status, NOW);
    expect(daysLeft).toBe(26);
    expect(daysLeft).toBeGreaterThan(5); // clearly more than the standard 5 days remaining
  });
});
