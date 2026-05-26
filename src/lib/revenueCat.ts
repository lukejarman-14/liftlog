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

let initialised = false;

/** Call once on app boot (after user is known). Safe to call multiple times. */
export async function rcConfigure(userId?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // web: RevenueCat not available
  if (initialised) return;
  if (!IOS_API_KEY) return; // key not configured — skip silently in production
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: userId ?? null });
    initialised = true;
  } catch { /* silent — RC unavailable */ }
}

/**
 * Returns true if the entitlement is active, false if definitively inactive,
 * or null if the check could not be completed (offline / RC error).
 */
export async function rcCheckEntitlement(): Promise<boolean | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
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

/** Purchase a package by plan ID. Returns true on success. */
export async function rcPurchase(plan: RCPlan): Promise<{ success: boolean; cancelled: boolean }> {
  if (!Capacitor.isNativePlatform()) return { success: false, cancelled: false };
  try {
    const offering = await rcGetOfferings();
    if (!offering) return { success: false, cancelled: false };

    const packageId = PLAN_TO_PACKAGE[plan] ?? plan;
    const pkg = offering.availablePackages.find((p: { identifier: string }) =>
      p.identifier === packageId
    );
    if (!pkg) return { success: false, cancelled: false };

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    return { success: active, cancelled: false };
  } catch (err: unknown) {
    const isCancel = (err as { userCancelled?: boolean })?.userCancelled === true;
    return { success: false, cancelled: isCancel };
  }
}

/** Restore previous purchases (required by App Store guidelines). */
export async function rcRestore(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}
