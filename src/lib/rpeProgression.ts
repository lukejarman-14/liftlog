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

const ratedSets = (sets: CompletedSet[]) => sets.filter(s => s.rir !== undefined);

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

  const rated = ratedSets(lastSets);

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
  const rated = ratedSets(allSets);
  if (!rated.length) return null;
  const avg = rated.reduce((a, s) => a + (s.rir ?? 0), 0) / rated.length;
  return Math.round(avg * 10) / 10;
}

/** RIR labels for display */
const RPE_LABELS: Record<number, string> = {
  0: 'Max effort',
  1: '1 rep left',
  2: '2 reps left',
  3: '3 reps left',
  4: '4+ reps left',
};

export const RIR_LABELS = RPE_LABELS;

// ── Weekly progression ────────────────────────────────────────────────────────

export interface WeeklySuggestion {
  suggestedWeight: number;
  goalReps: number;
  action: RpeAction;
  reason: string;
  colour: 'green' | 'blue' | 'amber';
}

/**
 * WEEKLY PROGRESSION: Given last session's completed sets for an exercise,
 * suggest the weight and goal reps for the next session.
 *
 * Rep completion drives the primary decision:
 *   All sets hit target reps  →  progressive overload (increase weight)
 *   Fell short of target reps →  same weight, goal = avg + 1 rep (build to target)
 *   Exceeded target reps       →  suggest increase weight, keep same rep target
 *
 * RIR data (when present) refines the weight jump:
 *   avg RIR ≥ targetRir + 2  →  +5 kg (very easy)
 *   avg RIR ≥ targetRir + 1  →  +2.5 kg (slightly easy)
 *   avg RIR ≈ targetRir       →  +2.5 kg (on target, earned the increment)
 *   avg RIR ≤ targetRir - 1  →  maintain (too hard, consolidate before progressing)
 */
export function weeklyProgressionSuggestion(
  lastSets: CompletedSet[],
  targetSets: number,
  targetReps: number,
  targetRir: number = 2,
): WeeklySuggestion | null {
  if (!lastSets?.length) return null;

  // Use only the sets that correspond to the prescribed volume
  const relevantSets = lastSets.slice(0, targetSets);
  if (!relevantSets.length) return null;

  const lastWeight = relevantSets[relevantSets.length - 1].weight;
  if (lastWeight <= 0) return null; // bodyweight / reps-only exercises excluded

  const avgReps = relevantSets.reduce((sum, s) => sum + s.reps, 0) / relevantSets.length;
  const allHitTarget = relevantSets.every(s => s.reps >= targetReps);

  const rated = ratedSets(relevantSets);
  const avgRir = rated.length > 0
    ? rated.reduce((sum, s) => sum + (s.rir ?? 0), 0) / rated.length
    : null;

  if (!allHitTarget) {
    // Athlete fell short — consolidate at same weight, give incremental rep goal
    const avgRepsRounded = Math.round(avgReps);
    const goalReps = Math.min(targetReps, avgRepsRounded + 1);
    return {
      suggestedWeight: lastWeight,
      goalReps,
      action: 'maintain',
      reason: `Avg ${avgRepsRounded} reps last week. Hit ${goalReps} reps this week.`,
      colour: 'blue',
    };
  }

  // All sets hit target — progressive overload
  let weightStep: number;
  let reason: string;

  if (avgRir !== null) {
    const rirDiff = avgRir - targetRir;
    if (rirDiff >= 2) {
      weightStep = STRENGTH_STEP * 2; // +5 kg
      reason = `Avg ${avgRir.toFixed(1)} RIR — well in the tank. +5 kg.`;
    } else if (rirDiff >= 0) {
      weightStep = STRENGTH_STEP; // +2.5 kg
      reason = `Hit all reps at ${avgRir.toFixed(1)} RIR. Progress +2.5 kg.`;
    } else {
      // Went too hard (below target RIR) but still completed — maintain weight, consolidate
      return {
        suggestedWeight: lastWeight,
        goalReps: targetReps,
        action: 'maintain',
        reason: `Completed all reps but very hard (avg ${avgRir.toFixed(1)} RIR). Same weight.`,
        colour: 'blue',
      };
    }
  } else {
    // No RIR data — standard linear progression
    weightStep = STRENGTH_STEP;
    reason = `All sets complete. Add 2.5 kg.`;
  }

  const suggestedWeight = roundKg(lastWeight + weightStep);
  return {
    suggestedWeight,
    goalReps: targetReps,
    action: 'increase',
    reason,
    colour: 'green',
  };
}
