/**
 * RIR-driven progression logic (Reps In Reserve)
 *
 * Intra-session: after each set, compare actual vs target RIR and suggest
 * a weight adjustment for the next set.
 *
 * Inter-session: use last session's RIR-calibrated sets to establish an
 * opening weight baseline so the athlete starts at the right intensity.
 *
 * RIR scale: 0 = max effort (0 reps left), 4 = very easy (4+ reps left).
 * Higher RIR = easier. Lower RIR = harder.
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
 * INTRA-SESSION: Given the RIR just recorded, suggest next-set weight.
 *
 * Rules:
 *   actual RIR > target + 1  →  increase (athlete had more in the tank)
 *   actual RIR = target      →  maintain
 *   actual RIR < target - 1  →  decrease (athlete went too hard)
 */
export function intraSessionSuggestion(
  targetRir: number,
  actualRir: number,
  currentWeight: number,
): RpeSuggestion {
  const diff = actualRir - targetRir;  // positive = easier than intended, negative = harder

  if (diff >= 1) {
    const step = diff >= 2 ? STRENGTH_STEP * 2 : STRENGTH_STEP;
    const next = roundKg(currentWeight + step);
    return {
      action: 'increase',
      suggestedWeight: next,
      delta: step,
      message: `${actualRir} RIR — more in the tank. Try +${step}kg next set.`,
      colour: 'green',
    };
  }

  if (diff <= -1) {
    const step = diff <= -2 ? STRENGTH_STEP * 2 : STRENGTH_STEP;
    const next = roundKg(Math.max(0, currentWeight - step));
    return {
      action: 'decrease',
      suggestedWeight: next,
      delta: -step,
      message: `${actualRir} RIR — went too hard. Drop ${step}kg next set.`,
      colour: 'red',
    };
  }

  return {
    action: 'maintain',
    suggestedWeight: currentWeight,
    delta: 0,
    message: `${actualRir} RIR — on target. Maintain weight.`,
    colour: 'blue',
  };
}

/**
 * INTER-SESSION: Given last session's sets (which may have RIR data),
 * return a calibrated opening weight for the current session.
 */
export function interSessionBaseline(
  lastSets: CompletedSet[],
  targetRir: number,
): { weight: number; reps: number; confidence: 'calibrated' | 'estimated' } | null {
  if (!lastSets?.length) return null;

  const rated = lastSets.filter(s => s.rir !== undefined);

  if (rated.length > 0) {
    // Closest to target RIR
    const anchor = rated.reduce((prev, curr) =>
      Math.abs((curr.rir ?? 0) - targetRir) < Math.abs((prev.rir ?? 0) - targetRir)
        ? curr
        : prev
    );
    const suggestion = intraSessionSuggestion(targetRir, anchor.rir!, anchor.weight);
    return {
      weight: suggestion.suggestedWeight,
      reps: anchor.reps,
      confidence: 'calibrated',
    };
  }

  // No RIR data — return last set weight as-is
  const last = lastSets[lastSets.length - 1];
  return { weight: last.weight, reps: last.reps, confidence: 'estimated' };
}

/**
 * Compute the average RIR logged across all completed sets in a session.
 */
export function sessionAvgRpe(allSets: CompletedSet[]): number | null {
  const rated = allSets.filter(s => s.rir !== undefined);
  if (!rated.length) return null;
  const avg = rated.reduce((a, s) => a + (s.rir ?? 0), 0) / rated.length;
  return Math.round(avg * 10) / 10;
}

/** RIR labels for display */
export const RPE_LABELS: Record<number, string> = {
  0: 'Max effort',
  1: '1 rep left',
  2: '2 reps left',
  3: '3 reps left',
  4: '4+ reps left',
};

export const RIR_LABELS = RPE_LABELS;
