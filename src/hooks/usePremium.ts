/**
 * usePremium — reads and writes PremiumStatus from localStorage.
 *
 * Trial logic:
 *   - First time a free user hits a gated feature we stamp trialStartedAt.
 *   - Trial lasts 14 days. After that, isPremium must be true (paid).
 *   - RevenueCat sets isPremium + purchasedAt via setPremium() when wired up.
 */

import { useState, useCallback } from 'react';
import { PremiumStatus } from '../types';

const KEY = 'vf_premium';
const TRIAL_DAYS = 14;
const MS_PER_DAY = 86_400_000;

function load(): PremiumStatus {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PremiumStatus;
  } catch { /* ignore */ }
  return { isPremium: false };
}

function save(status: PremiumStatus) {
  localStorage.setItem(KEY, JSON.stringify(status));
}

export function usePremium() {
  const [status, setStatusRaw] = useState<PremiumStatus>(load);

  const refresh = useCallback(() => {
    const fresh = load();
    setStatusRaw(fresh);
    return fresh;
  }, []);

  /** True if user currently has access (paid OR active trial). */
  const hasAccess = (() => {
    if (status.isPremium) return true;
    if (!status.trialStartedAt) return false;
    const elapsed = Date.now() - status.trialStartedAt;
    return elapsed < TRIAL_DAYS * MS_PER_DAY;
  })();

  /** Days remaining in trial (null if not in trial or already premium). */
  const trialDaysLeft = (() => {
    if (status.isPremium || !status.trialStartedAt) return null;
    const elapsed = Date.now() - status.trialStartedAt;
    const remaining = Math.ceil((TRIAL_DAYS * MS_PER_DAY - elapsed) / MS_PER_DAY);
    return remaining > 0 ? remaining : 0;
  })();

  const isTrialActive = trialDaysLeft !== null && trialDaysLeft > 0;
  const isTrialExpired = status.trialStartedAt != null && !status.isPremium && !isTrialActive;

  /** Call when user first taps a gated feature — starts the trial clock. */
  const startTrial = useCallback(() => {
    const current = load();
    if (current.trialStartedAt || current.isPremium) return;
    const updated: PremiumStatus = { ...current, trialStartedAt: Date.now() };
    save(updated);
    setStatusRaw(updated);
  }, []);

  /** Called by RevenueCat webhook / purchase callback. */
  const setPremium = useCallback((plan: 'monthly' | 'annual', expiresAt?: number, rcCustomerId?: string) => {
    const updated: PremiumStatus = {
      isPremium: true,
      plan,
      purchasedAt: Date.now(),
      expiresAt,
      rcCustomerId,
      trialStartedAt: status.trialStartedAt,
    };
    save(updated);
    setStatusRaw(updated);
  }, [status.trialStartedAt]);

  /** Remove premium (e.g. subscription lapsed). */
  const revokePremium = useCallback(() => {
    const updated: PremiumStatus = { ...load(), isPremium: false, plan: undefined, expiresAt: undefined };
    save(updated);
    setStatusRaw(updated);
  }, []);

  return {
    status,
    hasAccess,
    isTrialActive,
    isTrialExpired,
    trialDaysLeft,
    startTrial,
    setPremium,
    revokePremium,
    refresh,
  };
}
