/**
 * RevenueCat integration for Vector Football Premium.
 *
 * iOS API key:  test_ktVUtaxmNiAZqaswMCgsOsigyOq  (replace with live key before App Store submission)
 * Entitlement:  vectorfootball.co.uk Pro
 * Products:     monthly | yearly | lifetime
 */

import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const IOS_API_KEY = 'test_ktVUtaxmNiAZqaswMCgsOsigyOq';
const ENTITLEMENT_ID = 'vectorfootball.co.uk Pro';

export type RCPlan = 'monthly' | 'yearly' | 'lifetime';

let initialised = false;

/** Call once on app boot (after user is known). Safe to call multiple times. */
export async function rcConfigure(userId?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // web: RevenueCat not available
  if (initialised) return;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: IOS_API_KEY, appUserID: userId ?? null });
    initialised = true;
  } catch { /* silent — RC unavailable */ }
}

/** Returns true if the user has an active premium entitlement. */
export async function rcCheckEntitlement(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
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

    const pkg = offering.availablePackages.find((p: { product: { identifier: string } }) =>
      p.product.identifier === plan
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
