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
  // 30-day baselines read directly from Apple Health (null when no history).
  avgSleepHours: number | null;
  avgHrvMs: number | null;
  avgRestingHr: number | null;
  // Distinct measured days inside the baseline window. Scores that depend on
  // personal baselines wait until day 6, once five previous days exist.
  sleepBaselineDays: number | null;
  hrvBaselineDays: number | null;
  restingHrBaselineDays: number | null;
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

// ─── Sleep score algorithm ─────────────────────────────────────────────────

export const MIN_RECOVERY_BASELINE_DAYS = 5;

function lerp(value: number, waypoints: [number, number][]): number {
  if (value <= waypoints[0][0]) return waypoints[0][1];
  if (value >= waypoints[waypoints.length - 1][0]) return waypoints[waypoints.length - 1][1];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [x0, y0] = waypoints[i];
    const [x1, y1] = waypoints[i + 1];
    if (value >= x0 && value <= x1) return y0 + (y1 - y0) * ((value - x0) / (x1 - x0));
  }
  return waypoints[waypoints.length - 1][1];
}

/**
 * Compute a 0–100 sleep quality score from up to four metrics.
 *
 * Components (weights when all available):
 *   Total duration  45% — most important; 7.5–9 h is the athletic sweet spot
 *   Deep sleep %    25% — physical recovery, HGH release, muscle repair (15–25% optimal)
 *   REM sleep %     20% — cognitive recovery, memory consolidation, mood (20–25% optimal)
 *   Awake %         10% — sleep continuity; higher awake % = more fragmented
 *
 * When a breakdown metric is absent its weight is redistributed proportionally.
 */
export function calcSleepScore(
  totalHours: number,
  deepHours?: number,
  remHours?: number,
  awakeHours?: number,
  avgSleepHours?: number | null,
  sleepBaselineDays?: number | null,
): number {
  const durationScore = lerp(totalHours, [
    [4, 0], [5, 18], [6, 50], [7, 80], [7.5, 93], [8, 100],
    [8.5, 100], [9, 95], [9.5, 85], [10, 72], [11, 58], [12, 45],
  ]);

  const hasBreakdown = deepHours != null || remHours != null || awakeHours != null;
  if (totalHours <= 0) return 0;

  const pctOf = (h: number) => h / totalHours;

  let deepScore: number | null = null;
  if (deepHours != null) {
    deepScore = lerp(pctOf(deepHours), [
      [0, 0], [0.08, 15], [0.12, 42], [0.15, 68], [0.20, 92],
      [0.23, 100], [0.25, 98], [0.30, 85], [0.35, 68], [0.40, 50],
    ]);
  }

  let remScore: number | null = null;
  if (remHours != null) {
    remScore = lerp(pctOf(remHours), [
      [0, 0], [0.10, 20], [0.15, 55], [0.20, 88], [0.23, 98],
      [0.25, 100], [0.28, 95], [0.30, 85], [0.35, 70],
    ]);
  }

  let awakeScore: number | null = null;
  if (awakeHours != null) {
    awakeScore = lerp(pctOf(awakeHours), [
      [0, 100], [0.04, 97], [0.08, 88], [0.12, 72],
      [0.16, 52], [0.20, 35], [0.30, 15], [0.50, 0],
    ]);
  }

  let sum = durationScore * 45;
  let weights = 45;
  if (deepScore  != null) { sum += deepScore  * 25; weights += 25; }
  if (remScore   != null) { sum += remScore   * 20; weights += 20; }
  if (awakeScore != null) { sum += awakeScore * 10; weights += 10; }

  const metricScore = hasBreakdown ? sum / weights : durationScore;

  // Once Apple Health has five previous sleep days, fold in the athlete's own
  // sleep baseline. Before that, use the absolute duration score only.
  if (
    avgSleepHours != null &&
    avgSleepHours > 0 &&
    (sleepBaselineDays ?? 0) >= MIN_RECOVERY_BASELINE_DAYS
  ) {
    const personalScore = lerp(totalHours / avgSleepHours, [
      [0.60, 0], [0.75, 25], [0.85, 55], [0.95, 82],
      [1.00, 94], [1.08, 100], [1.20, 92], [1.35, 70],
      [1.50, 50],
    ]);
    return Math.round(metricScore * 0.75 + personalScore * 0.25);
  }

  return Math.round(metricScore);
}

/**
 * Compute a 0–100 fatigue/recovery score from today's HRV & resting HR relative
 * to the athlete's own 30-day Apple Health baseline. 100 = fully fresh/recovered,
 * 0 = heavily fatigued (matches the sleep score: higher is always better).
 *
 *   HRV  (65%): higher than baseline = fresher. Suppressed HRV = fatigue/strain.
 *   RHR  (35%): lower than baseline = fresher. Elevated RHR = fatigue/illness/strain.
 *
 * Returns null when neither metric can be compared to a baseline (e.g. no Apple
 * Health history yet) — the caller then falls back to the manual slider.
 */
export function calcFatigueScore(
  hrvMs: number | null | undefined,
  restingHr: number | null | undefined,
  avgHrvMs: number | null | undefined,
  avgRestingHr: number | null | undefined,
  hrvBaselineDays?: number | null,
  restingHrBaselineDays?: number | null,
): number | null {
  let hrvScore: number | null = null;
  const hrvReady = (hrvBaselineDays ?? 0) >= MIN_RECOVERY_BASELINE_DAYS;
  if (hrvReady && hrvMs != null && avgHrvMs != null && avgHrvMs > 0) {
    hrvScore = lerp(hrvMs / avgHrvMs, [
      [0.70, 0], [0.80, 25], [0.88, 45], [0.95, 70],
      [1.00, 88], [1.05, 100], [1.30, 100],
    ]);
  }

  let rhrScore: number | null = null;
  const restingHrReady = (restingHrBaselineDays ?? 0) >= MIN_RECOVERY_BASELINE_DAYS;
  if (restingHrReady && restingHr != null && avgRestingHr != null && avgRestingHr > 0) {
    rhrScore = lerp(restingHr / avgRestingHr, [
      [0.90, 100], [0.96, 98], [1.00, 88], [1.04, 68],
      [1.08, 45], [1.12, 22], [1.20, 0],
    ]);
  }

  if (hrvScore == null && rhrScore == null) return null;
  if (hrvScore != null && rhrScore != null) {
    return Math.round(hrvScore * 0.65 + rhrScore * 0.35);
  }
  return Math.round((hrvScore ?? rhrScore)!);
}

/**
 * Map sleep duration (hours) onto the 1–5 sleep-quality scale.
 * Delegates to calcSleepScore for consistent scoring.
 */
export function sleepHoursToScore(hours: number): 1 | 2 | 3 | 4 | 5 {
  const s = calcSleepScore(hours);
  if (s >= 88) return 5;
  if (s >= 72) return 4;
  if (s >= 50) return 3;
  if (s >= 28) return 2;
  return 1;
}

