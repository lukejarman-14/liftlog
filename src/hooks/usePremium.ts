/**
 * usePremium — manages premium status via RevenueCat (native) or localStorage (web).
 *
 * Trial logic:
 *   - First time a free user hits a gated feature we stamp trialStartedAt.
 *   - Trial lasts 30 days. After that, isPremium must be true (paid).
 *   - RevenueCat sets isPremium on successful purchase / restore (iOS).
 *   - Stripe (web) + squad/promo/referral access come from the server-side
 *     entitlement record, read via syncEntitlementFromServer().
 */

import { useState, useCallback, useMemo } from 'react';
import { PremiumStatus } from '../types';
import { supabase } from '../lib/supabase';
import { rcPurchase, rcRestore, rcCheckEntitlement, RCPlan } from '../lib/revenueCat';
import { redeemPromoCode } from '../lib/promoCodes';
import { redeemReferralCode, claimReferralRewards, registerReferralCode } from '../lib/referrals';
import { REFERRALS_ENABLED } from '../lib/featureFlags';
import { computeHasAccess, computeTrialDaysLeft } from '../lib/premiumUtils';
import { Capacitor } from '@capacitor/core';

export type { RCPlan };

const KEY = 'vf_premium';


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

function revokeLocalPremium(current: PremiumStatus = load(), fullRevoke = false): PremiumStatus {
  // Native RC-revoke (fullRevoke=false): preserve a still-valid server grant's
  // expiresAt — promo/referral/squad grants carry a future expiresAt that
  // computeHasAccess honours without isPremium, and syncEntitlementFromServer
  // re-confirms them right after, so the user stays in even if that call is slow.
  // Web server-revoke (fullRevoke=true): the server is authoritative for EVERY web
  // grant and has said no access, so clear expiresAt too — there's nothing to
  // re-confirm, and a stale grant must not linger.
  const keepExpiry = !fullRevoke && current.expiresAt != null && current.expiresAt > Date.now();
  const updated: PremiumStatus = {
    ...current,
    isPremium: false,
    plan: undefined,
    expiresAt: keepExpiry ? current.expiresAt : undefined,
    purchasedAt: undefined,
    rcCustomerId: undefined,
  };
  save(updated);
  return updated;
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
  const hasAccess = useMemo(() => computeHasAccess(status), [status]);

  /** Days remaining in trial (null if not in trial or already premium). */
  const trialDaysLeft = useMemo(() => computeTrialDaysLeft(status), [status]);

  const isTrialActive = trialDaysLeft !== null && trialDaysLeft > 0;
  const isTrialExpired = status.trialStartedAt != null && !status.isPremium && !isTrialActive;

  /** Call when user first taps a gated feature — starts the trial clock.
   *  When signed in, the trial is stamped SERVER-SIDE via start_trial() so it
   *  can't be reset/extended by editing localStorage and so the checkout
   *  repeat-trial guard can see it. Local trialStartedAt is kept as a UI cache. */
  const startTrial = useCallback(async () => {
    const current = load();
    if (current.trialStartedAt || current.isPremium) return;
    if (Capacitor.isNativePlatform()) {
      setPurchaseError('On iPhone, the free trial must be started through Apple. Please use the Apple subscription sheet.');
      return;
    }
    if (supabase) {
      // server owns the authoritative trial clock; ignore RPC errors and still
      // set the local cache so the UI reflects the trial offline.
      try { await supabase.rpc('start_trial'); } catch { /* offline — local only */ }
    }
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
      const { success, cancelled, expiresAt, error } = await rcPurchase(plan);
      if (success) {
        setPremium(plan, expiresAt ?? undefined);
        return true;
      }
      // Show the REAL reason (not a generic message) so failures are diagnosable.
      if (!cancelled) setPurchaseError(error ?? 'Purchase failed. Please try again.');
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
      const { active, expiresAt } = await rcRestore();
      if (active) {
        // Preserve existing plan if known. If unknown, leave plan undefined rather than
        // guessing 'yearly' — a lifetime purchaser would otherwise see the wrong label.
        const current = load();
        const updated: PremiumStatus = {
          ...current,
          isPremium: true,
          plan: current.plan,
          purchasedAt: current.purchasedAt ?? Date.now(),
          expiresAt: expiresAt ?? current.expiresAt,
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

  /**
   * Sync access from the SERVER-AUTHORITATIVE entitlement (Stripe web purchases,
   * squad-inherited, promo/referral grants, server trial).
   *
   * On WEB the server is the source of truth for every grant, so this both grants
   * AND revokes: a returned no-access fully clears local premium (a stale grant
   * must not survive a refund / cancellation / logout-relogin). RPC errors or
   * empty data never revoke, so a transient failure keeps current access.
   *
   * On NATIVE this never revokes — RevenueCat/StoreKit is authoritative there, so
   * an incomplete server view (e.g. an iOS RC purchase not yet mirrored
   * server-side) can't lock anyone out. The dangerous spoof path (faking premium
   * to publish a Pro squad) is closed by the server-authoritative register_squad RPC.
   */
  const syncEntitlementFromServer = useCallback(async (): Promise<PremiumStatus> => {
    const current = load();
    if (!supabase) return current;
    try {
      const { data, error } = await supabase.rpc('get_my_entitlement');
      if (error || !data) return current;
      const ent = data as {
        has_access?: boolean; is_premium?: boolean;
        plan?: PremiumStatus['plan']; expires_at?: number;
      };
      if (!ent.has_access) {
        // On web the server is authoritative for EVERY grant (Stripe, promo,
        // referral, squad), so a no-access result fully revokes — including any
        // stale future expiresAt — so a refunded/cancelled grant can't linger and
        // old localStorage premium can't survive a logout/delete/relogin.
        const hasLocalGrant =
          current.isPremium || (current.expiresAt != null && current.expiresAt > Date.now());
        if (!Capacitor.isNativePlatform() && hasLocalGrant) {
          const revoked = revokeLocalPremium(current, true);
          setStatusRaw(revoked);
          return revoked;
        }
        return current;
      }
      const updated: PremiumStatus = {
        ...current,
        isPremium: ent.is_premium === true ? true : current.isPremium,
        plan: ent.plan ?? current.plan,
        expiresAt: typeof ent.expires_at === 'number' ? ent.expires_at : current.expiresAt,
        purchasedAt: current.purchasedAt ?? Date.now(),
      };
      save(updated);
      setStatusRaw(updated);
      return updated;
    } catch {
      return current;
    }
  }, []);

  /** Sync premium status from RC (call on app boot and after login). */
  const syncFromRC = useCallback(async () => {
    const result = await rcCheckEntitlement();
    // null means RC couldn't be reached — preserve existing status
    if (result === null) return;

    const current = load();
    if (result.active) {
      const needsUpdate =
        !current.isPremium ||
        (result.expiresAt !== null && result.expiresAt !== current.expiresAt);
      if (needsUpdate) {
        const updated: PremiumStatus = {
          ...current,
          isPremium: true,
          expiresAt: result.expiresAt ?? current.expiresAt,
        };
        save(updated);
        setStatusRaw(updated);
      }
    } else {
      // On iOS, RevenueCat/StoreKit is authoritative for App Store purchases.
      // If it confirms there is no active entitlement, stale local premium must
      // be cleared immediately. Server grants (promo/squad) are re-applied by
      // syncEntitlementFromServer() after this.
      if (Capacitor.isNativePlatform() && current.isPremium) {
        const revoked = revokeLocalPremium(current);
        setStatusRaw(revoked);
        return;
      }

      // Web fallback: revoke monthly/yearly subs only — never lifetime, and
      // skip if a timed grant is still running.
      const timedGrantLapsed = current.expiresAt != null && current.expiresAt < Date.now();
      if (
        current.isPremium &&
        (current.plan === 'monthly' || current.plan === 'yearly') &&
        (!current.expiresAt || timedGrantLapsed)
      ) {
        const updated: PremiumStatus = {
          ...current,
          isPremium: false,
          plan: undefined,
          expiresAt: undefined,
        };
        save(updated);
        setStatusRaw(updated);
      }
    }
  }, []);

  /** Redeem a referral code — grants 21-day trial. Returns error string or null on success. */
  const redeemReferral = useCallback(async (code: string, userId: string): Promise<string | null> => {
    // Referrals are disabled during the pre-season 30-day-trial period. The UI is
    // hidden, but guard here too so the path is inert even if reached directly.
    if (!REFERRALS_ENABLED) return 'Referrals are not available right now.';
    // Don't replace an active lifetime or open-ended RC subscription.
    const current = load();
    if (current.isPremium && !current.expiresAt) {
      return 'You already have an active premium subscription.';
    }

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
    const trialExpiry = Date.now() + result.trialMs;
    const withExpiry: PremiumStatus = {
      ...load(),
      trialStartedAt: Date.now(),
      expiresAt: trialExpiry,
    };
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
      // Don't force isPremium — referral rewards extend trial-style time access only.
      // hasAccess derives from expiresAt > Date.now() when isPremium is false, so
      // access is still granted for the full reward period without polluting plan state.
      expiresAt: base + msToAdd,
      purchasedAt: current.purchasedAt ?? Date.now(),
    };
    save(updated);
    setStatusRaw(updated);
  }, []);

  /** Register this user's referral code in Supabase and return it. */
  const getOrCreateReferralCode = useCallback(async (userId: string): Promise<string> => {
    try {
      return await registerReferralCode(userId);
    } catch {
      throw new Error('Could not save your referral code. Check your connection and try again.');
    }
  }, []);

  /** Redeem a promo code — grants 30 days premium. Returns error string or null on success. */
  const redeemPromo = useCallback(async (code: string): Promise<string | null> => {
    const result = await redeemPromoCode(code);
    if (!result.success) {
      const msgs: Record<string, string> = {
        invalid: 'That code is not valid.',
        already_used: 'This code has already been redeemed on your account.',
        inactive: 'That code is no longer active.',
        not_authenticated: 'Please sign in, then try again.',
        email_unconfirmed: 'Please confirm your email address first — check your inbox for a confirmation link, then try again.',
        rate_limited: 'Too many attempts. Please wait a moment and try again.',
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
    const updated = revokeLocalPremium();
    setStatusRaw(updated);
  }, []);

  /** Reset all premium state for a new account. RC will restore real purchases on next boot. */
  const resetForNewUser = useCallback(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem('vf_trial_prompt_shown');
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
    setPurchaseError,
    startTrial,
    setPremium,
    purchase,
    restore,
    redeemPromo,
    redeemReferral,
    claimReferralRewardsForUser,
    getOrCreateReferralCode,
    syncFromRC,
    syncEntitlementFromServer,
    revokePremium,
    resetForNewUser,
    refresh,
  };
}
