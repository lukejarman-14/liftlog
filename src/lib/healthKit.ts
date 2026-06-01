// Apple HealthKit bridge — READ-ONLY recovery metrics for Daily Readiness.
//
// Talks to the native HealthKitPlugin (ios/App/App/HealthKitPlugin.swift).
// Every entry point is guarded so this is a no-op on web (vectorfootball.co.uk)
// and Android — HealthKit only exists on iOS. Callers can use these freely
// without platform checks of their own.

import { registerPlugin, Capacitor } from '@capacitor/core';

export interface RecoveryData {
  sleepHours: number | null;
  hrvMs: number | null;
  restingHr: number | null;
}

interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ granted: boolean }>;
  fetchRecovery(): Promise<RecoveryData>;
}

const HealthKit = registerPlugin<HealthKitPlugin>('HealthKit');

/** True only on native iOS, where HealthKit can exist. */
export function isHealthKitSupported(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Whether Health data is available on this device (false off-iOS). */
export async function isHealthAvailable(): Promise<boolean> {
  if (!isHealthKitSupported()) return false;
  try {
    return (await HealthKit.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Show the Health permission sheet. Resolves false (never throws) on failure. */
export async function connectHealth(): Promise<boolean> {
  if (!isHealthKitSupported()) return false;
  try {
    return (await HealthKit.requestAuthorization()).granted;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[healthKit] requestAuthorization failed:', err);
    return false;
  }
}

/** Fetch last night's recovery metrics. Returns null (never throws) when unavailable. */
export async function fetchRecovery(): Promise<RecoveryData | null> {
  if (!isHealthKitSupported()) return null;
  try {
    return await HealthKit.fetchRecovery();
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[healthKit] fetchRecovery failed:', err);
    return null;
  }
}

/**
 * Map sleep duration (hours) onto the app's 1–5 sleep-quality scale.
 * Bands chosen for an athletic population where 7–8.5h is the target.
 */
export function sleepHoursToScore(hours: number): 1 | 2 | 3 | 4 | 5 {
  if (hours >= 8.5) return 5;
  if (hours >= 7) return 4;
  if (hours >= 6) return 3;
  if (hours >= 5) return 2;
  return 1;
}

/**
 * Map HRV (ms) onto the app's 1–5 FATIGUE scale (inverted — 1 = fresh, 5 = wiped).
 * Higher HRV = better autonomic recovery = lower fatigue score.
 * Bands based on adult athletic population norms.
 */
export function hrvToFatigueScore(hrvMs: number): 1 | 2 | 3 | 4 | 5 {
  if (hrvMs >= 70) return 1;
  if (hrvMs >= 55) return 2;
  if (hrvMs >= 40) return 3;
  if (hrvMs >= 25) return 4;
  return 5;
}

/**
 * Map resting heart rate (bpm) onto the app's 1–5 STRESS scale (inverted — 1 = calm, 5 = stressed).
 * Elevated resting HR signals sympathetic nervous system activation / physiological stress.
 */
export function restingHrToStressScore(bpm: number): 1 | 2 | 3 | 4 | 5 {
  if (bpm <= 50) return 1;
  if (bpm <= 60) return 2;
  if (bpm <= 70) return 3;
  if (bpm <= 80) return 4;
  return 5;
}
