/**
 * Programme generator — exercise resolution tests
 *
 * For every position × gym access × season combination the generator supports,
 * assert that every exercise in every session resolves to a known library ID
 * with no fuzzy matching and no silent drops.
 *
 * A failure here means a new exercise name was added to the generator without
 * a corresponding entry in NAME_TO_ID. The test output tells you exactly which
 * NAME_TO_ID line to add to fix it.
 */

import { describe, it, expect } from 'vitest';
import { generateProgramme } from '../programmeGenerator';
import { validateProgrammeSession } from '../sessionUtils';
import { DEFAULT_EXERCISES as EXERCISES } from '../../data/exercises';
import type { ProgrammeInputs } from '../../types';

// ── Config matrix ──────────────────────────────────────────────────────────

const POSITIONS: ProgrammeInputs['position'][] = ['GK', 'CB', 'FB', 'CM', 'W', 'ST'];
const GYM_ACCESS: ProgrammeInputs['gymAccess'][] = ['full', 'basic', 'none'];
const SEASONS = [false, true]; // false = in-season, true = off-season

function makeInputs(
  position: ProgrammeInputs['position'],
  gymAccess: ProgrammeInputs['gymAccess'],
  offSeason: boolean,
): ProgrammeInputs {
  return {
    position,
    playStyle: 'box-to-box',
    experienceYears: '3-5',
    sessionsPerWeek: 3,
    gymSessionsPerWeek: 2,
    conditioningSessionsPerWeek: 1,
    conditioningTypes: ['zone2'],
    matchesPerWeek: 1,
    primaryGoal: 'speed',
    secondaryGoals: [],
    matchDay: 'saturday',
    biggestWeakness: 'speed',
    injuryHistory: [],
    gymAccess,
    offSeason,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Collect all unique exercise names in a programme that have no exerciseId stamped. */
function findUnstampedExercises(inputs: ProgrammeInputs): string[] {
  const programme = generateProgramme(inputs);
  const unstamped = new Set<string>();
  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      for (const block of session.blocks) {
        for (const pe of block.exercises) {
          if (!pe.exerciseId) unstamped.add(pe.name);
        }
      }
    }
  }
  return Array.from(unstamped).sort();
}

/** Collect all validation issues across all sessions of a generated programme. */
function findAllIssues(inputs: ProgrammeInputs): {
  dropped: string[];
  fuzzyMatched: { programmeName: string; resolvedId: string; resolvedName: string }[];
} {
  const programme = generateProgramme(inputs);
  const allDropped = new Set<string>();
  const allFuzzy = new Map<string, { programmeName: string; resolvedId: string; resolvedName: string }>();

  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      const { dropped, fuzzyMatched } = validateProgrammeSession(session, EXERCISES);
      dropped.forEach(d => allDropped.add(d));
      fuzzyMatched.forEach(f => allFuzzy.set(f.programmeName, f));
    }
  }

  return {
    dropped: Array.from(allDropped).sort(),
    fuzzyMatched: Array.from(allFuzzy.values()).sort((a, b) => a.programmeName.localeCompare(b.programmeName)),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Programme generator — exercise ID stamping', () => {
  for (const position of POSITIONS) {
    for (const gymAccess of GYM_ACCESS) {
      for (const offSeason of SEASONS) {
        const label = `${position} / ${gymAccess} gym / ${offSeason ? 'off-season' : 'in-season'}`;

        it(`every ProgrammeExercise has exerciseId stamped: ${label}`, () => {
          const inputs = makeInputs(position, gymAccess, offSeason);
          const unstamped = findUnstampedExercises(inputs);

          if (unstamped.length > 0) {
            const lines = unstamped.map(name =>
              `  '${name.toLowerCase()}': '<exercise-id>',  // ADD TO NAME_TO_ID in sessionUtils.ts`
            ).join('\n');
            throw new Error(
              `[${label}] ${unstamped.length} exercise(s) could not be resolved at generation time.\n` +
              `These will fall through to runtime fuzzy-matching and may be silently dropped.\n\n` +
              `Add these entries to NAME_TO_ID in src/lib/sessionUtils.ts:\n${lines}`,
            );
          }

          expect(unstamped).toHaveLength(0);
        });
      }
    }
  }
});

describe('Programme generator — runtime resolution (belt-and-suspenders)', () => {
  for (const position of POSITIONS) {
    for (const gymAccess of GYM_ACCESS) {
      for (const offSeason of SEASONS) {
        const label = `${position} / ${gymAccess} gym / ${offSeason ? 'off-season' : 'in-season'}`;

        it(`no exercises dropped or fuzzy-matched at session-start: ${label}`, () => {
          const inputs = makeInputs(position, gymAccess, offSeason);
          const { dropped, fuzzyMatched } = findAllIssues(inputs);

          if (dropped.length > 0) {
            const lines = dropped.map(name =>
              `  '${name.toLowerCase()}': '<exercise-id>',`
            ).join('\n');
            throw new Error(
              `[${label}] ${dropped.length} exercise(s) dropped at runtime:\n${lines}\n` +
              `Add these to NAME_TO_ID in src/lib/sessionUtils.ts`,
            );
          }

          if (fuzzyMatched.length > 0) {
            const lines = fuzzyMatched.map(({ programmeName, resolvedId }) =>
              `  '${programmeName.toLowerCase()}': '${resolvedId}',  // currently fuzzy-matched`
            ).join('\n');
            throw new Error(
              `[${label}] ${fuzzyMatched.length} exercise(s) resolved by fragile fuzzy-match:\n${lines}\n` +
              `Add explicit entries to NAME_TO_ID to make these deterministic`,
            );
          }

          expect(dropped).toHaveLength(0);
          expect(fuzzyMatched).toHaveLength(0);
        });
      }
    }
  }
});
