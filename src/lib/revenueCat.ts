/**
 * RevenueCat integration for Vector Football Premium.
 * Entitlement:  vectorfootball.co.uk Pro
 * Packages:     $rc_monthly | $rc_annual | $rc_lifetime
 */

import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
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

let configuredUserId: string | null = null;

/** Call on app boot and after login. Re-configures if the user changes (e.g. logout → new login). */
export async function rcConfigure(userId?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!IOS_API_KEY) return;
  const nextId = userId ?? null;
  if (configuredUserId === nextId) return;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: nextId });
    configuredUserId = nextId;
  } catch { /* RC unavailable */ }
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
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
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
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

export type RCPurchaseResult = {
  success: boolean;
  cancelled: boolean;
  /** Expiry timestamp (ms). null for lifetime purchases or when unavailable. */
  expiresAt: number | null;
};

/** Purchase a package by plan ID. */
export async function rcPurchase(plan: RCPlan): Promise<RCPurchaseResult> {
  if (!Capacitor.isNativePlatform()) return { success: false, cancelled: false, expiresAt: null };
  try {
    const offering = await rcGetOfferings();
    if (!offering) return { success: false, cancelled: false, expiresAt: null };

    const packageId = PLAN_TO_PACKAGE[plan] ?? plan;
    const pkg = offering.availablePackages.find((p: { identifier: string }) =>
      p.identifier === packageId
    );
    if (!pkg) return { success: false, cancelled: false, expiresAt: null };

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return { success: false, cancelled: false, expiresAt: null };

    const expiresAt = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;
    return { success: true, cancelled: false, expiresAt };
  } catch (err: unknown) {
    const isCancel = (err as { userCancelled?: boolean })?.userCancelled === true;
    return { success: false, cancelled: isCancel, expiresAt: null };
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
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return { active: false, expiresAt: null };
    const expiresAt = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;
    return { active: true, expiresAt };
  } catch {
    return { active: false, expiresAt: null };
  }
}
