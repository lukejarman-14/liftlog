/**
 * Programme generator — player preference and injury override tests.
 *
 * Guards regressions in the back squat / BSS / trap bar selection logic.
 * The bug this protects against: preferBackSquat was silently ignored for
 * in-season users because the season guard ran BEFORE the preference check.
 *
 * Rules under test:
 *   1. preferBackSquat: true  → Back Squat regardless of season or goal
 *   2. injuryHistory: ['back'] or ['hamstring'] → never Back Squat, even with preference
 *   3. gymAccess: 'none' → never Back Squat (no barbell)
 *   4. Trap Bar play style + preferBackSquat → Back Squat wins (preference overrides trap bar)
 *   5. No preference, in-season → BSS (not Back Squat)
 */

import { describe, it, expect } from 'vitest';
import { generateProgramme } from '../programmeGenerator';
import type { ProgrammeInputs } from '../../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function base(over: Partial<ProgrammeInputs> = {}): ProgrammeInputs {
  return {
    position: 'CM',
    playStyle: 'box-to-box',
    experienceYears: '3-5',
    sessionsPerWeek: 3,
    gymSessionsPerWeek: 2,
    conditioningSessionsPerWeek: 1,
    conditioningTypes: ['zone2'],
    matchesPerWeek: 1,
    primaryGoal: 'strength',
    matchDay: 'saturday',
    biggestWeakness: 'strength',
    injuryHistory: [],
    gymAccess: 'full',
    offSeason: false, // in-season by default — the harder case for back squat
    ...over,
  };
}

/** Collect all exercise names across every session in a programme. */
function allExerciseNames(inputs: ProgrammeInputs): string[] {
  const programme = generateProgramme(inputs);
  const names: string[] = [];
  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      for (const block of session.blocks) {
        for (const ex of block.exercises) {
          names.push(ex.name.toLowerCase());
        }
      }
    }
  }
  return names;
}

function hasBackSquat(names: string[]): boolean {
  return names.some(n => n.includes('back squat') || n.includes('barbell back squat'));
}

function hasBSS(names: string[]): boolean {
  return names.some(n => n.includes('bulgarian') || n.includes('split squat'));
}

function hasTrapBar(names: string[]): boolean {
  return names.some(n => n.includes('trap bar') || n.includes('hex bar'));
}

// ─── Back squat preference ────────────────────────────────────────────────────

describe('Back squat preference (preferBackSquat)', () => {
  it('in-season + preferBackSquat: true → Back Squat is used', () => {
    const names = allExerciseNames(base({ offSeason: false, preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(true);
  });

  it('off-season + preferBackSquat: true → Back Squat is used', () => {
    const names = allExerciseNames(base({ offSeason: true, preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(true);
  });

  it('speed goal + preferBackSquat: true → Back Squat still used (preference beats goal)', () => {
    const names = allExerciseNames(base({ primaryGoal: 'speed', preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(true);
  });

  it('in-season + no preference → Back Squat NOT used (defaults to BSS)', () => {
    const names = allExerciseNames(base({ offSeason: false, preferBackSquat: false, playStyle: 'technical' }));
    expect(hasBackSquat(names)).toBe(false);
  });
});

// ─── Injury overrides ─────────────────────────────────────────────────────────

describe('Injury history overrides back squat preference', () => {
  it('back injury + preferBackSquat → NO Back Squat (injury always wins)', () => {
    const names = allExerciseNames(base({ injuryHistory: ['back'], preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(false);
  });

  it('hamstring injury + preferBackSquat → NO Back Squat', () => {
    const names = allExerciseNames(base({ injuryHistory: ['hamstring'], preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(false);
  });

  it('knee injury + preferBackSquat → Back Squat still used (knee doesn\'t block it)', () => {
    const names = allExerciseNames(base({ injuryHistory: ['knee'], preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(true);
  });

  it('back injury without preference → defaults to BSS', () => {
    const names = allExerciseNames(base({ injuryHistory: ['back'], preferBackSquat: false, playStyle: 'technical' }));
    expect(hasBackSquat(names)).toBe(false);
    expect(hasBSS(names)).toBe(true);
  });
});

// ─── Gym access ───────────────────────────────────────────────────────────────

describe('Gym access blocks back squat when no barbell available', () => {
  it('gymAccess: none + preferBackSquat → no Back Squat (no barbell)', () => {
    const names = allExerciseNames(base({ gymAccess: 'none', preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(false);
  });

  it('gymAccess: basic + preferBackSquat → Back Squat is used', () => {
    const names = allExerciseNames(base({ gymAccess: 'basic', preferBackSquat: true }));
    expect(hasBackSquat(names)).toBe(true);
  });
});

// ─── Trap bar vs. back squat ──────────────────────────────────────────────────

describe('Trap bar play style vs. back squat preference', () => {
  it('trap-bar play style + no preference → Trap Bar used (not Back Squat)', () => {
    // box-to-box is a trap-bar play style
    const names = allExerciseNames(base({ playStyle: 'box-to-box', preferBackSquat: false, gymAccess: 'full' }));
    expect(hasTrapBar(names)).toBe(true);
    expect(hasBackSquat(names)).toBe(false);
  });

  it('trap-bar play style + preferBackSquat → Back Squat overrides trap bar', () => {
    const names = allExerciseNames(base({ playStyle: 'box-to-box', preferBackSquat: true, gymAccess: 'full' }));
    expect(hasBackSquat(names)).toBe(true);
    expect(hasTrapBar(names)).toBe(false);
  });
});
