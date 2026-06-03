/**
 * Eccentric exercise — methodType propagation tests.
 *
 * Guards the fix where methodType: 'eccentric' was present on ProgrammeExercise
 * but not carried through to WorkoutExercise / SessionExercise.
 *
 * Rules under test:
 *   1. Known eccentric exercises (Nordic, Copenhagen) always have methodType: 'eccentric'
 *   2. No exercise that is NOT eccentric is accidentally tagged as eccentric
 *   3. Every eccentric exercise in every position × gym × season combo is tagged
 *
 * If a new eccentric exercise is added to the generator without the methodType flag,
 * the RIR prompt will appear for it in active workout. This test catches that.
 */

import { describe, it, expect } from 'vitest';
import { generateProgramme } from '../programmeGenerator';
import type { ProgrammeInputs } from '../../types';

const POSITIONS: ProgrammeInputs['position'][] = ['GK', 'CB', 'FB', 'CM', 'W', 'ST'];
const GYM_ACCESS: ProgrammeInputs['gymAccess'][] = ['full', 'basic', 'none'];

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
    offSeason: false,
    ...over,
  };
}

// Names that are known eccentric exercises — these MUST have methodType: 'eccentric'
// NOTE: "Copenhagen Plank" (the plain hold) is methodType: 'isometric' — correct.
//       Only "Copenhagen Plank — Eccentric Lower" is an eccentric.
const KNOWN_ECCENTRIC_NAMES = [
  'nordic hamstring curl',
  'copenhagen plank — eccentric lower',
  'alfredson eccentric',
  'eccentric calf',
];

function isKnownEccentric(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_ECCENTRIC_NAMES.some(e => lower.includes(e));
}

interface ExerciseRecord {
  name: string;
  methodType?: string;
  position: string;
  gymAccess: string;
  offSeason: boolean;
}

function collectExercises(inputs: ProgrammeInputs, label: { position: string; gymAccess: string; offSeason: boolean }): ExerciseRecord[] {
  const programme = generateProgramme(inputs);
  const records: ExerciseRecord[] = [];
  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      for (const block of session.blocks) {
        for (const ex of block.exercises) {
          records.push({ name: ex.name, methodType: ex.methodType, ...label });
        }
      }
    }
  }
  return records;
}

describe('Eccentric exercises have methodType: "eccentric"', () => {
  it('known eccentric exercises are always tagged across all positions and configs', () => {
    const missing: string[] = [];

    for (const position of POSITIONS) {
      for (const gymAccess of GYM_ACCESS) {
        for (const offSeason of [false, true]) {
          const label = `${position}/${gymAccess}/${offSeason ? 'off' : 'in'}`;
          const exercises = collectExercises(base({ position, gymAccess, offSeason }), { position, gymAccess, offSeason });

          for (const ex of exercises) {
            if (isKnownEccentric(ex.name) && ex.methodType !== 'eccentric') {
              missing.push(`[${label}] "${ex.name}" missing methodType — RIR will incorrectly appear in workout`);
            }
          }
        }
      }
    }

    expect(
      missing,
      `\nEccentric exercises missing methodType:\n${missing.join('\n')}`,
    ).toHaveLength(0);
  });

  it('non-eccentric exercises are NOT tagged as eccentric', () => {
    const wronglyTagged: string[] = [];

    for (const position of POSITIONS) {
      const exercises = collectExercises(base({ position }), { position, gymAccess: 'full', offSeason: false });

      for (const ex of exercises) {
        if (ex.methodType === 'eccentric' && !isKnownEccentric(ex.name)) {
          wronglyTagged.push(`"${ex.name}" (position: ${position}) tagged eccentric but not in known list`);
        }
      }
    }

    // If this fires it means a new exercise got tagged eccentric unexpectedly.
    // Update KNOWN_ECCENTRIC_NAMES above if the exercise really is eccentric.
    expect(
      wronglyTagged,
      `\nUnexpected eccentric tags:\n${wronglyTagged.join('\n')}`,
    ).toHaveLength(0);
  });
});

describe('Eccentric block is present for all full-gym configurations', () => {
  it('at least one eccentric exercise appears in every full-gym programme', () => {
    const missing: string[] = [];

    for (const position of POSITIONS) {
      for (const offSeason of [false, true]) {
        const label = `${position}/${offSeason ? 'off' : 'in'}`;
        const exercises = collectExercises(base({ position, gymAccess: 'full', offSeason }), { position, gymAccess: 'full', offSeason });
        const hasEccentric = exercises.some(ex => ex.methodType === 'eccentric');
        if (!hasEccentric) {
          missing.push(`[${label}] No eccentric exercise found — resilience block may be missing`);
        }
      }
    }

    expect(
      missing,
      `\nProgrammes missing eccentric block:\n${missing.join('\n')}`,
    ).toHaveLength(0);
  });
});
