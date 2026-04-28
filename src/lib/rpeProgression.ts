/**
 * RPE-driven progression logic
 *
 * Intra-session: after each set, compare actual vs target RPE and suggest
 * a weight adjustment for the next set.
 *
 * Inter-session: use last session's RPE-calibrated sets to establish an
 * opening weight baseline, so the athlete starts at the right intensity
 * rather than guessing from raw weight numbers.
 */

import { CompletedSet } from '../types';

export type RpeAction = 'increase' | 'maintain' | 'decrease';

export interface RpeSuggestion {
  action: RpeAction;
  suggestedWeight: number;
  delta: number;              // positive = increase, negative = decrease, 0 = maintain
  message: string;
  colour: 'green' | 'blue' | 'red';
}

const STRENGTH_STEP = 2.5;   // kg — standard plate increment

/** Round to nearest 0.25 kg (bar clip precision) */
function roundKg(kg: number): number {
  return Math.round(kg * 4) / 4;
}

/**
 * INTRA-SESSION: Given the RPE just recorded, suggest next-set weight.
 *
 * Rules (per the system spec):
 *   actual ≤ target − 1  →  increase (by 2.5 or 5 kg if 2+ under)
 *   actual = target      →  maintain
 *   actual ≥ target + 1  →  decrease (by 2.5 or 5 kg if 2+ over)
 */
export function intraSessionSuggestion(
  targetRpe: number,
  actualRpe: number,
  currentWeight: number,
): RpeSuggestion {
  const diff = actualRpe - targetRpe;

  if (diff <= -1) {
    const step = diff <= -2 ? STRENGTH_STEP * 2 : STRENGTH_STEP;
    const next = roundKg(currentWeight + step);
    return {
      action: 'increase',
      suggestedWeight: next,
      delta: step,
      message: `RPE ${actualRpe} — feeling strong. Try +${step}kg next set.`,
      colour: 'green',
    };
  }

  if (diff >= 1) {
    const step = diff >= 2 ? STRENGTH_STEP * 2 : STRENGTH_STEP;
    const next = roundKg(Math.max(0, currentWeight - step));
    return {
      action: 'decrease',
      suggestedWeight: next,
      delta: -step,
      message: `RPE ${actualRpe} — heavy. Drop ${step}kg next set.`,
      colour: 'red',
    };
  }

  return {
    action: 'maintain',
    suggestedWeight: currentWeight,
    delta: 0,
    message: `RPE ${actualRpe} — on target. Maintain weight.`,
    colour: 'blue',
  };
}

/**
 * INTER-SESSION: Given last session's sets (which may have RPE data),
 * return a calibrated opening weight for the current session.
 *
 * Logic:
 *   1. If sets have RPE → find the set closest to targetRpe, then apply
 *      an intra-session adjustment from that RPE toward the target.
 *      This means: if last session was RPE 9 vs target 7, we suggest
 *      lighter weight to bring this session into the target zone.
 *   2. If no RPE data → fall back to last set's weight (original behaviour)
 *      with 'estimated' confidence so the UI can show a caveat.
 *
 * Returns null when there are no prior sets.
 */
export function interSessionBaseline(
  lastSets: CompletedSet[],
  targetRpe: number,
): { weight: number; reps: number; confidence: 'calibrated' | 'estimated' } | null {
  if (!lastSets?.length) return null;

  const rated = lastSets.filter(s => s.rpe !== undefined);

  if (rated.length > 0) {
    // Closest to target RPE
    const anchor = rated.reduce((prev, curr) =>
      Math.abs((curr.rpe ?? 10) - targetRpe) < Math.abs((prev.rpe ?? 10) - targetRpe)
        ? curr
        : prev
    );
    // Apply one adjustment step from anchor toward target
    const suggestion = intraSessionSuggestion(targetRpe, anchor.rpe!, anchor.weight);
    return {
      weight: suggestion.suggestedWeight,
      reps: anchor.reps,
      confidence: 'calibrated',
    };
  }

  // No RPE data — return last set weight as-is
  const last = lastSets[lastSets.length - 1];
  return { weight: last.weight, reps: last.reps, confidence: 'estimated' };
}

/**
 * Compute the average RPE logged across all completed sets in a session.
 * Used for load-management load scoring.
 */
export function sessionAvgRpe(allSets: CompletedSet[]): number | null {
  const rated = allSets.filter(s => s.rpe !== undefined);
  if (!rated.length) return null;
  const avg = rated.reduce((a, s) => a + (s.rpe ?? 0), 0) / rated.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Session RPE label for display.
 */
export const RPE_LABELS: Record<number, string> = {
  1: 'Very easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Somewhat hard',
  5: 'Hard',
  6: 'Hard+',
  7: 'Very hard',
  8: 'Very very hard',
  9: 'Near max',
  10: 'Maximum',
};
