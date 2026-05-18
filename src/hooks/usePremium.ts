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
        // Determine plan from RC entitlement check (best effort — default yearly for restore)
        const current = load();
        const updated: PremiumStatus = {
          ...current,
          isPremium: true,
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
    purchasing,
    restoring,
    purchaseError,
    startTrial,
    setPremium,
    purchase,
    restore,
    syncFromRC,
    revokePremium,
    refresh,
  };
}
