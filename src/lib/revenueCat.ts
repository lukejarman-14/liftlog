/**
 * RevenueCat integration for Vector Football Premium.
 * Entitlement:  vectorfootball.co.uk Pro
 * Packages:     $rc_monthly | $rc_annual | $rc_lifetime
 */

import { Purchases, LOG_LEVEL, type PurchasesOffering } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
if (import.meta.env.DEV && !IOS_API_KEY) {
  console.warn('[RevenueCat] VITE_REVENUECAT_IOS_KEY is not set — in-app purchases will not work on native.');
}
const ENTITLEMENT_ID = 'vectorfootball.co.uk Pro';

const PLAN_TO_PACKAGE: Record<string, string> = {
  monthly:  '$rc_monthly',
  yearly:   '$rc_annual',
  lifetime: '$rc_lifetime',
};

export type RCPlan = 'monthly' | 'yearly' | 'lifetime';

let isConfigured = false;
let configuredUserId: string | null = null;
let lastOfferingsError: string | null = null;

type RevenueCatEntitlementInfo = {
  expirationDate?: string | null;
};

type RevenueCatCustomerInfo = {
  entitlements?: {
    active?: Record<string, RevenueCatEntitlementInfo | undefined>;
  };
};

function describeRevenueCatError(err: unknown): string {
  if (!err) return 'Unknown RevenueCat error.';
  if (typeof err === 'string') return err;

  const candidate = err as {
    message?: string;
    errorMessage?: string;
    readableErrorCode?: string;
    code?: string | number;
    errorCode?: string | number;
    underlyingErrorMessage?: string;
  };

  const parts = [
    candidate.message,
    candidate.errorMessage,
    candidate.underlyingErrorMessage,
    candidate.readableErrorCode,
    candidate.code != null ? `code ${candidate.code}` : undefined,
    candidate.errorCode != null ? `error ${candidate.errorCode}` : undefined,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(part => part.trim());

  return Array.from(new Set(parts)).join(' — ') || String(err);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

/**
 * A GENUINE user cancellation, per RevenueCat's explicit signals only.
 * We deliberately do NOT match the word "cancel" in the error message: a real
 * StoreKit failure (store problem, payment pending/deferred, account/sandbox
 * issue) often contains "cancel" in its text, and treating it as a user-cancel
 * silently swallows the error so the user never sees WHY the purchase failed.
 * RevenueCat's cancel code is PURCHASE_CANCELLED_ERROR = "1".
 */
function isUserCancellation(err: unknown): boolean {
  const candidate = err as {
    userCancelled?: boolean | null;
    code?: string | number;
    errorCode?: string | number;
    readableErrorCode?: string;
  };
  return (
    candidate?.userCancelled === true ||
    String(candidate?.code) === '1' ||
    String(candidate?.errorCode) === '1' ||
    candidate?.readableErrorCode === 'PURCHASE_CANCELLED'
  );
}

function findActiveEntitlement(customerInfo: RevenueCatCustomerInfo) {
  const activeEntitlements = customerInfo.entitlements?.active ?? {};
  const activeIds = Object.keys(activeEntitlements);

  const exact = activeEntitlements[ENTITLEMENT_ID];
  if (exact) return { entitlement: exact, activeIds };

  const normalisedExpected = ENTITLEMENT_ID.trim().toLowerCase();
  const matchingId = activeIds.find(id => id.trim().toLowerCase() === normalisedExpected);
  if (matchingId && activeEntitlements[matchingId]) {
    return { entitlement: activeEntitlements[matchingId]!, activeIds };
  }

  // RevenueCat has confirmed one active entitlement after purchase/restore. Accept it
  // instead of blocking a successful StoreKit purchase because of an ID formatting mismatch.
  if (activeIds.length === 1 && activeEntitlements[activeIds[0]]) {
    return { entitlement: activeEntitlements[activeIds[0]]!, activeIds };
  }

  return { entitlement: null, activeIds };
}

/**
 * Call on app boot and after login. Configures RevenueCat exactly ONCE, then
 * switches identity via logIn/logOut — never re-configure() per user. Re-running
 * configure() for a different user on a shared device can leave purchases or
 * entitlements attached to the previous identity (Codex #13).
 */
export async function rcConfigure(userId?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!IOS_API_KEY) return;
  const nextId = userId ?? null;
  try {
    if (!isConfigured) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: nextId ?? undefined });
      isConfigured = true;
      configuredUserId = nextId;
      return;
    }
    if (nextId === configuredUserId) return;
    // Identity change on an already-configured SDK — use logIn/logOut.
    if (nextId) {
      await Purchases.logIn({ appUserID: nextId });
    } else {
      await Purchases.logOut();
    }
    configuredUserId = nextId;
  } catch { /* RC unavailable */ }
}

/** Detach the RevenueCat identity on logout (shared-device hygiene). */
export async function rcLogOut(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !IOS_API_KEY || !isConfigured) return;
  try {
    await Purchases.logOut();
    configuredUserId = null;
  } catch { /* already anonymous / RC unavailable */ }
}

export type RCEntitlementStatus = {
  active: boolean;
  /** Unix timestamp (ms) when the entitlement expires. null for lifetime or if unavailable. */
  expiresAt: number | null;
};

/**
 * Returns the entitlement status and expiry, or null if the check could not be
 * completed (offline / RC error). A null return means "preserve existing status".
 */
export async function rcCheckEntitlement(): Promise<RCEntitlementStatus | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const { entitlement } = findActiveEntitlement(customerInfo);
    if (!entitlement) return { active: false, expiresAt: null };
    const expiry = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;
    return { active: true, expiresAt: expiry };
  } catch {
    return null; // network error or RC unavailable — preserve existing status
  }
}

/** Fetch available packages for the default offering. */
export async function rcGetOfferings() {
  if (!Capacitor.isNativePlatform()) return null;
  lastOfferingsError = null;

  if (!IOS_API_KEY) {
    lastOfferingsError = 'RevenueCat iOS API key is missing from this build.';
    return null;
  }

  try {
    if (!isConfigured) {
      await rcConfigure();
    }

    const offerings = await Purchases.getOfferings() as {
      current?: PurchasesOffering | null;
      all?: Record<string, PurchasesOffering>;
    };
    const fallbackOffering =
      offerings.all?.default ??
      Object.values(offerings.all ?? {})[0] ??
      null;
    const offering = offerings.current ?? fallbackOffering;

    if (!offering) {
      lastOfferingsError = 'RevenueCat returned no current/default offering for this customer.';
      if (import.meta.env.DEV) console.warn('[RC] getOfferings: no offering returned. Check RevenueCat dashboard → Offerings.');
    } else {
      if (!offerings.current && import.meta.env.DEV) {
        console.warn('[RC] getOfferings: no current offering returned; using fallback offering:', offering.identifier ?? 'unknown');
      }
      if (import.meta.env.DEV) console.log('[RC] getOfferings: OK — packages:', offering.availablePackages.map((p: { identifier: string }) => p.identifier));
    }
    return offering;
  } catch (err) {
    lastOfferingsError = describeRevenueCatError(err);
    console.error('[RC] getOfferings failed:', err);
    return null;
  }
}

export type RCPurchaseResult = {
  success: boolean;
  cancelled: boolean;
  /** Expiry timestamp (ms). null for lifetime purchases or when unavailable. */
  expiresAt: number | null;
  /** Human-readable failure reason — surfaced in the paywall so we can SEE why a
   *  purchase failed (App Store review showed only a generic "purchase failed"). */
  error?: string;
};

/** Purchase a package by plan ID. */
export async function rcPurchase(plan: RCPlan): Promise<RCPurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, cancelled: false, expiresAt: null, error: 'Not a native device.' };
  }
  let confirmedNoEntitlementBeforePurchase = false;
  try {
    const offering = await rcGetOfferings();
    if (!offering) {
      if (import.meta.env.DEV) console.error('[RC] rcPurchase: no offering available — cannot purchase.');
      return { success: false, cancelled: false, expiresAt: null,
        error: lastOfferingsError
          ? `RevenueCat could not load products: ${lastOfferingsError}`
          : 'No RevenueCat offering loaded — check the API key in the build and that an offering is marked Current.' };
    }

    const packageId = PLAN_TO_PACKAGE[plan] ?? plan;
    const pkg = offering.availablePackages.find((p: { identifier: string }) =>
      p.identifier === packageId
    );
    if (!pkg) {
      const available = offering.availablePackages.map((p: { identifier: string }) => p.identifier).join(', ') || 'none';
      if (import.meta.env.DEV) console.error(`[RC] rcPurchase: package "${packageId}" not found. Available:`, available);
      return { success: false, cancelled: false, expiresAt: null,
        error: `Package "${packageId}" not in the offering (available: ${available}).` };
    }

    const entitlementBeforePurchase = await rcCheckEntitlement();
    confirmedNoEntitlementBeforePurchase = entitlementBeforePurchase?.active === false;
    if (entitlementBeforePurchase?.active) {
      return { success: false, cancelled: false, expiresAt: entitlementBeforePurchase.expiresAt,
        error: 'An App Store subscription is already active for this Apple ID. Tap Restore purchases to unlock it instead of starting a new trial.' };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const { entitlement, activeIds } = findActiveEntitlement(customerInfo);
    if (!entitlement) {
      // Receipt may not have propagated to RevenueCat yet (common in sandbox).
      // Wait and re-fetch before declaring failure.
      try {
        await delay(2000);
        const { customerInfo: refreshed } = await Purchases.getCustomerInfo();
        const { entitlement: refreshedEntitlement } = findActiveEntitlement(refreshed);
        if (refreshedEntitlement) {
          const expiresAt = refreshedEntitlement.expirationDate
            ? new Date(refreshedEntitlement.expirationDate).getTime()
            : null;
          return { success: true, cancelled: false, expiresAt };
        }
      } catch { /* fall through to failure */ }
      const active = activeIds.join(', ') || 'none';
      if (import.meta.env.DEV) console.error(`[RC] rcPurchase: entitlement "${ENTITLEMENT_ID}" not active. Active:`, active);
      return { success: false, cancelled: false, expiresAt: null,
        error: `Bought OK, but entitlement "${ENTITLEMENT_ID}" isn't active (active: ${active}).` };
    }

    const expiresAt = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;
    return { success: true, cancelled: false, expiresAt };
  } catch (err: unknown) {
    const message = describeRevenueCatError(err);
    const cancelled = isUserCancellation(err);

    // The purchase may have actually completed even though purchasePackage threw
    // (late receipt sync, sandbox flakiness, or a mislabeled cancellation). Give
    // RevenueCat a moment, then trust the real entitlement state only when we
    // proved there was no active entitlement before this purchase attempt.
    if (confirmedNoEntitlementBeforePurchase) {
      try {
        await delay(1200);
        const { customerInfo } = await Purchases.getCustomerInfo();
        const { entitlement } = findActiveEntitlement(customerInfo);
        if (entitlement) {
          const expiresAt = entitlement.expirationDate
            ? new Date(entitlement.expirationDate).getTime()
            : null;
          return { success: true, cancelled: false, expiresAt };
        }
      } catch {
        // entitlement re-check failed too — fall through to the failure result
      }
    }

    if (!cancelled && import.meta.env.DEV) console.error('[RC] rcPurchase threw:', err);
    return { success: false, cancelled, expiresAt: null,
      error: cancelled ? undefined : `StoreKit error: ${message}` };
  }
}

export type RCRestoreResult = {
  active: boolean;
  expiresAt: number | null;
};

/** Restore previous purchases (required by App Store guidelines). */
export async function rcRestore(): Promise<RCRestoreResult> {
  if (!Capacitor.isNativePlatform()) return { active: false, expiresAt: null };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const { entitlement } = findActiveEntitlement(customerInfo);
    if (!entitlement) return { active: false, expiresAt: null };
    const expiresAt = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;
    return { active: true, expiresAt };
  } catch {
    return { active: false, expiresAt: null };
  }
}
