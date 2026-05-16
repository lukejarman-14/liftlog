/**
 * Progressive Overload Engine — Vector Football Premium
 *
 * Converts a user's 1RM baseline into week-by-week weight targets
 * for every tracked strength lift in a generated programme.
 *
 * Model:
 *   • Base % is parsed from each exercise's `intensity` string (e.g. "82% 1RM")
 *   • Within each phase, load rises +2.5% per week (micro-progressive overload)
 *   • Weights rounded to nearest 2.5 kg (standard barbell plate increment)
 *   • 1RM estimated via Epley formula: 1RM = w × (1 + reps / 30)
 */

import { GeneratedProgramme } from '../types';

// ── Lift catalogue ────────────────────────────────────────────────────────

export const LIFT_KEYS = ['squat', 'hipThrust', 'hinge', 'bss', 'upperPush', 'upperPull'] as const;
export type LiftKey = typeof LIFT_KEYS[number];

export interface LiftMeta {
  label: string;         // short display name
  askName: string;       // label shown in setup modal
  hint: string;          // guidance for the user
  patterns: string[];    // lowercase substrings matched against exercise name
}

export const LIFT_META: Record<LiftKey, LiftMeta> = {
  squat: {
    label: 'Squat',
    askName: 'Back Squat',
    hint: 'Enter your best Back Squat or Trap Bar Deadlift working set.',
    patterns: ['back squat', 'trap bar deadlift'],
  },
  hipThrust: {
    label: 'Hip Thrust',
    askName: 'Hip Thrust (Barbell)',
    hint: 'Enter your best Hip Thrust working set — bar across hips.',
    patterns: ['hip thrust', 'barbell hip thrust'],
  },
  hinge: {
    label: 'RDL / Deadlift',
    askName: 'Romanian Deadlift',
    hint: 'Enter your best Romanian Deadlift or conventional Deadlift working set.',
    patterns: ['romanian deadlift', 'rdl', 'trap bar deadlift'],
  },
  bss: {
    label: 'Bulgarian Split Squat',
    askName: 'Bulgarian Split Squat (rear foot elevated)',
    hint: 'Rear foot on bench, front foot forward — single-leg squat to depth. Enter the total dumbbell load (both dumbbells combined, e.g. 2 × 20 kg = 40 kg) for your best set per leg.',
    patterns: ['bulgarian split squat'],
  },
  upperPush: {
    label: 'Bench Press',
    askName: 'Bench Press',
    hint: 'Enter your best Bench Press working set.',
    patterns: ['bench press'],
  },
  upperPull: {
    label: 'Pull-Up / Row',
    askName: 'Pull-Up or Bent-Over Row',
    hint: 'For Weighted Pull-Up enter bodyweight + added weight. For Row enter bar weight.',
    patterns: ['pull-up', 'chin-up', 'bent-over row', 'barbell row', 'weighted pull'],
  },
};

// ── Epley 1RM estimation ──────────────────────────────────────────────────

/** Epley formula. Returns estimated 1RM in kg. */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

// ── Exercise → lift key mapping ───────────────────────────────────────────

/** Returns the LiftKey if the exercise name matches a tracked pattern, else null. */
export function getLiftKey(exerciseName: string): LiftKey | null {
  const lower = exerciseName.toLowerCase();
  for (const key of LIFT_KEYS) {
    if (LIFT_META[key].patterns.some(p => lower.includes(p))) return key;
  }
  return null;
}

// ── Intensity % parser ────────────────────────────────────────────────────

/**
 * Parses "82% 1RM", "82% 1RM equiv.", etc. → 0.82
 * Returns null if the string contains no parseable percentage.
 */
export function parseBasePct(intensity?: string): number | null {
  if (!intensity) return null;
  const m = intensity.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return parseFloat(m[1]) / 100;
}

// ── Phase helpers ─────────────────────────────────────────────────────────

function getPhaseForWeek(weekNumber: number, totalWeeks: number): string {
  const p = weekNumber / totalWeeks;
  if (p <= 0.25) return 'Foundation';
  if (p <= 0.50) return 'Build';
  if (p <= 0.75) return 'Strength & Power';
  return 'Peak';
}

/**
 * Returns which week within the current phase this week is (1-based).
 * Foundation week 1 → 1, Foundation week 2 → 2, first week of Build → 1, etc.
 */
export function weekInPhase(weekNumber: number, totalWeeks: number): number {
  const targetPhase = getPhaseForWeek(weekNumber, totalWeeks);
  let firstWeek = weekNumber;
  for (let w = 1; w < weekNumber; w++) {
    if (getPhaseForWeek(w, totalWeeks) === targetPhase) {
      firstWeek = w;
      break;
    }
  }
  return weekNumber - firstWeek + 1;
}

// ── Core prescription ─────────────────────────────────────────────────────

/** Round kg to nearest 2.5 kg (standard barbell plate increment). */
function roundPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

/**
 * Given a 1RM and the exercise's base intensity string, compute the
 * week-specific target weight, incorporating micro-progression within the phase.
 *
 * Returns null if the intensity string cannot be parsed (e.g. sled push, bodyweight).
 */
export function prescribeWeekLoad(
  oneRMkg: number,
  intensity: string | undefined,
  weekNumber: number,
  totalWeeks: number,
): { kg: number; label: string } | null {
  if (!oneRMkg || oneRMkg <= 0) return null;
  const basePct = parseBasePct(intensity);
  if (basePct === null) return null;

  const wip = weekInPhase(weekNumber, totalWeeks);
  // +2.5% per week within phase; hard cap at 97% of 1RM
  const adjustedPct = Math.min(0.97, basePct + (wip - 1) * 0.025);
  const rawKg = oneRMkg * adjustedPct;
  const kg = roundPlate(rawKg);

  return {
    kg,
    label: `${kg} kg`,
  };
}

// ── Programme scanning ────────────────────────────────────────────────────

/**
 * Returns the set of LiftKeys that actually appear in the programme.
 * Used to decide which lifts to ask the user about during setup.
 */
export function findTrackedLiftsInProgramme(programme: GeneratedProgramme): LiftKey[] {
  const found = new Set<LiftKey>();
  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      for (const block of session.blocks) {
        for (const exercise of block.exercises) {
          // Only track exercises that have a parseable % intensity
          if (!parseBasePct(exercise.intensity)) continue;
          const key = getLiftKey(exercise.name);
          if (key) found.add(key);
        }
      }
    }
  }
  return LIFT_KEYS.filter(k => found.has(k));
}
