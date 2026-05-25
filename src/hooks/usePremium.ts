/**
 * usePremium — manages premium status via RevenueCat (native) or localStorage (web).
 *
 * Trial logic:
 *   - First time a free user hits a gated feature we stamp trialStartedAt.
 *   - Trial lasts 14 days. After that, isPremium must be true (paid).
 *   - RevenueCat sets isPremium on successful purchase / restore.
 */

import { useState, useCallback } from 'react';
import { PremiumStatus } from '../types';
import { rcPurchase, rcRestore, rcCheckEntitlement, RCPlan } from '../lib/revenueCat';
import { redeemPromoCode } from '../lib/promoCodes';
import { redeemReferralCode, claimReferralRewards, registerReferralCode } from '../lib/referrals';

export type { RCPlan };

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
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const fresh = load();
    setStatusRaw(fresh);
    return fresh;
  }, []);

  /** True if user currently has access (paid OR active trial). */
  const hasAccess = (() => {
    if (status.isPremium) {
      // Check expiry if set (subscription lapsed)
      if (status.expiresAt && status.expiresAt < Date.now()) return false;
      return true;
    }
    if (!status.trialStartedAt) return false;
    // Use expiresAt if set (extended referral trial), else standard 14-day window
    if (status.expiresAt) return status.expiresAt > Date.now();
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

  /** Unlock premium locally (called after successful RC purchase or restore). */
  const setPremium = useCallback((plan: 'monthly' | 'yearly' | 'lifetime', expiresAt?: number, rcCustomerId?: string) => {
    const updated: PremiumStatus = {
      isPremium: true,
      plan,
      purchasedAt: Date.now(),
      expiresAt,
      rcCustomerId,
      trialStartedAt: load().trialStartedAt,
    };
    save(updated);
    setStatusRaw(updated);
  }, []);

  /** Trigger a RevenueCat purchase. Returns success flag. */
  const purchase = useCallback(async (plan: RCPlan): Promise<boolean> => {
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const { success, cancelled } = await rcPurchase(plan);
      if (success) {
        setPremium(plan);
        return true;
      }
      if (!cancelled) setPurchaseError('Purchase failed. Please try again.');
      return false;
    } catch {
      setPurchaseError('Purchase failed. Please try again.');
      return false;
    } finally {
      setPurchasing(false);
    }
  }, [setPremium]);

  /** Restore previous purchases (App Store requirement). */
  const restore = useCallback(async (): Promise<boolean> => {
    setPurchaseError(null);
    setRestoring(true);
    try {
      // Check RC first
      const active = await rcRestore();
      if (active) {
        // Preserve existing plan if known; fall back to yearly (most common subscription)
        const current = load();
        const updated: PremiumStatus = {
          ...current,
          isPremium: true,
          plan: current.plan ?? 'yearly',
          purchasedAt: current.purchasedAt ?? Date.now(),
        };
        save(updated);
        setStatusRaw(updated);
        return true;
      }
      setPurchaseError('No previous purchases found.');
      return false;
    } catch {
      setPurchaseError('Restore failed. Please try again.');
      return false;
    } finally {
      setRestoring(false);
    }
  }, []);

  /** Sync premium status from RC (call on app boot after RC is configured). */
  const syncFromRC = useCallback(async () => {
    const active = await rcCheckEntitlement();
    if (active) {
      const current = load();
      if (!current.isPremium) {
        const updated: PremiumStatus = { ...current, isPremium: true };
        save(updated);
        setStatusRaw(updated);
      }
    }
  }, []);

  /** Redeem a referral code — grants 21-day trial. Returns error string or null on success. */
  const redeemReferral = useCallback(async (code: string, userId: string): Promise<string | null> => {
    const result = await redeemReferralCode(code, userId);
    if (!result.success) {
      const msgs: Record<string, string> = {
        invalid: 'That referral code is not valid.',
        self: "You can't use your own referral code.",
        already_used: 'You have already used a referral code.',
        error: 'Could not verify the code. Check your connection and try again.',
      };
      return msgs[result.reason] ?? 'Unable to process your request. Please try again.';
    }
    // Grant 21-day trial
    // Store an explicit expiry so hasAccess uses it rather than the 14-day default window
    const trialExpiry = Date.now() + result.trialMs;
    const updated: PremiumStatus = {
      ...load(),
      trialStartedAt: Date.now(),
    };
    const withExpiry: PremiumStatus = { ...updated, expiresAt: trialExpiry };
    save(withExpiry);
    setStatusRaw(withExpiry);
    return null;
  }, []);

  /** Check and apply any pending referral rewards (call on boot). Returns ms added. */
  const claimReferralRewardsForUser = useCallback(async (userId: string): Promise<void> => {
    const msToAdd = await claimReferralRewards(userId);
    if (msToAdd <= 0) return;
    const current = load();
    // Add time to existing expiry, or from now if no expiry set
    const base = current.expiresAt && current.expiresAt > Date.now()
      ? current.expiresAt
      : Date.now();
    const updated: PremiumStatus = {
      ...current,
      isPremium: true,
      expiresAt: base + msToAdd,
      purchasedAt: current.purchasedAt ?? Date.now(),
    };
    save(updated);
    setStatusRaw(updated);
  }, []);

  /** Register this user's referral code in Supabase and return it. */
  const getOrCreateReferralCode = useCallback(async (userId: string): Promise<string> => {
    return registerReferralCode(userId);
  }, []);

  /** Redeem a promo code — grants 30 days premium. Returns error string or null on success. */
  const redeemPromo = useCallback(async (code: string): Promise<string | null> => {
    const result = await redeemPromoCode(code);
    if (!result.success) {
      const msgs: Record<string, string> = {
        invalid: 'That code is not valid.',
        already_used: 'This code has already been used on this device.',
        inactive: 'That code is no longer active.',
        error: 'Could not verify the code. Check your connection and try again.',
      };
      return msgs[result.reason] ?? 'Unable to process your request. Please try again.';
    }
    const updated: PremiumStatus = {
      ...load(),
      isPremium: true,
      plan: 'monthly',
      purchasedAt: Date.now(),
      expiresAt: result.expiresAt,
    };
    save(updated);
    setStatusRaw(updated);
    return null;
  }, []);

  /** Remove premium (e.g. subscription lapsed). */
  const revokePremium = useCallback(() => {
    const updated: PremiumStatus = { ...load(), isPremium: false, plan: undefined, expiresAt: undefined };
    save(updated);
    setStatusRaw(updated);
  }, []);

  /**
   * Fully reset premium state for a fresh account / new onboarding.
   * Clears trial clock and all purchase data so the paywall shows correctly.
   * On native iOS, RevenueCat will restore any real purchase via syncFromRC().
   */
  const resetForNewUser = useCallback(() => {
    localStorage.removeItem(KEY);
    setStatusRaw({ isPremium: false });
  }, []);

  return {
    status,
    hasAccess,
    isTrialActive,
    isTrialExpired,
    trialDaysLeft,
    purchasing,
    restoring,
    purchaseError,
    startTrial,
    setPremium,
    purchase,
    restore,
    redeemPromo,
    redeemReferral,
    claimReferralRewardsForUser,
    getOrCreateReferralCode,
    syncFromRC,
    revokePremium,
    resetForNewUser,
    refresh,
  };
}
