/**
 * Programme generator — scheduling invariants.
 *
 * Guards the three scheduling fixes:
 *   1. A requested in-season gym count is honoured exactly (no silent fall-through
 *      to the 3-session schedule when 1 gym session is requested).
 *   2. No two sessions ever land on the same calendar day (gym/conditioning collisions).
 *   3. No gym or conditioning session ever lands on a match day.
 *
 * Plus belt-and-suspenders: no dropped / fuzzy-matched exercises, valid structure.
 */
import { describe, it, expect } from 'vitest';
import { generateProgramme } from '../programmeGenerator';
import { validateProgrammeSession } from '../sessionUtils';
import { DEFAULT_EXERCISES as EXERCISES } from '../../data/exercises';
import type { ProgrammeInputs } from '../../types';

const POSITIONS: ProgrammeInputs['position'][] = ['GK', 'CB', 'FB', 'CM', 'W', 'ST'];
const GYM: ProgrammeInputs['gymAccess'][] = ['full', 'basic', 'none'];
const MATCHDAYS: ProgrammeInputs['matchDay'][] = ['saturday', 'sunday', 'midweek'];
const COND_SUBSETS: ('zone2' | 'hiit' | 'rsa')[][] = [
  [], ['zone2'], ['hiit'], ['rsa'], ['zone2', 'hiit'], ['zone2', 'rsa'], ['hiit', 'rsa'], ['zone2', 'hiit', 'rsa'],
];
const PRIMARY_MATCH_DAY: Record<string, string> = { saturday: 'Saturday', sunday: 'Sunday', midweek: 'Wednesday' };

function inSeason(over: Partial<ProgrammeInputs>): ProgrammeInputs {
  return {
    position: 'CM', playStyle: 'box-to-box', experienceYears: '3-5',
    sessionsPerWeek: 3, gymSessionsPerWeek: 2, conditioningSessionsPerWeek: 1,
    conditioningTypes: ['zone2'], matchesPerWeek: 1, primaryGoal: 'speed',
    matchDay: 'saturday', biggestWeakness: 'speed', injuryHistory: [],
    gymAccess: 'full', offSeason: false, ...over,
  };
}

describe('Programme scheduling invariants', () => {
  it('no same-day collisions, no session on a match day, gym count honoured (in-season)', () => {
    const problems: string[] = [];

    for (const position of POSITIONS)
      for (const gymAccess of GYM)
        for (const matchDay of MATCHDAYS)
          for (const conditioningTypes of COND_SUBSETS)
            for (const gymSessionsPerWeek of [1, 2]) {
              const inputs = inSeason({ position, gymAccess, matchDay, conditioningTypes, gymSessionsPerWeek });
              const label = `${position}/${gymAccess}/${matchDay}/[${conditioningTypes.join('+')}]/gym${gymSessionsPerWeek}`;
              const p = generateProgramme(inputs);
              const wk = p.weeks[0];

              // gym count honoured exactly (single-match week ⇒ no slot shifting/dropping)
              const gymSessions = wk.sessions.filter(s => /^MD/.test(s.mdDay || ''));
              if (gymSessions.length !== gymSessionsPerWeek)
                problems.push(`${label}: requested ${gymSessionsPerWeek} gym, got ${gymSessions.length} (${gymSessions.map(s => s.mdDay).join(',')})`);

              for (const week of p.weeks) {
                const seen = new Map<string, string>();
                for (const s of week.sessions) {
                  // no collision
                  if (seen.has(s.dayOfWeek))
                    problems.push(`${label} wk${week.weekNumber}: collision on ${s.dayOfWeek} (${seen.get(s.dayOfWeek)} + ${s.mdDay})`);
                  seen.set(s.dayOfWeek, s.mdDay);
                  // never on the match day
                  if (s.dayOfWeek === PRIMARY_MATCH_DAY[matchDay])
                    problems.push(`${label} wk${week.weekNumber}: session on match day ${s.dayOfWeek}`);
                }
              }
            }

    expect(problems, `\n${problems.slice(0, 25).join('\n')}${problems.length > 25 ? `\n…+${problems.length - 25} more` : ''}`).toHaveLength(0);
  });

  it('no collisions with a second match day (double-game weeks)', () => {
    const problems: string[] = [];
    for (const matchDay of MATCHDAYS)
      for (const secondMatchDay of ['wednesday', 'tuesday', 'sunday'] as const)
        for (const conditioningTypes of COND_SUBSETS) {
          const inputs = inSeason({ matchDay, secondMatchDay, matchesPerWeek: 2, conditioningTypes });
          const label = `${matchDay}+${secondMatchDay}/[${conditioningTypes.join('+')}]`;
          for (const week of generateProgramme(inputs).weeks) {
            const seen = new Map<string, string>();
            for (const s of week.sessions) {
              if (seen.has(s.dayOfWeek)) problems.push(`${label} wk${week.weekNumber}: collision on ${s.dayOfWeek}`);
              seen.set(s.dayOfWeek, s.mdDay);
            }
          }
        }
    expect(problems, `\n${problems.slice(0, 25).join('\n')}`).toHaveLength(0);
  });

  it('every exercise resolves and every session has valid structure', () => {
    const problems: string[] = [];
    for (const position of POSITIONS)
      for (const gymAccess of GYM)
        for (const offSeason of [false, true])
          for (const conditioningTypes of COND_SUBSETS)
            for (const gymSessionsPerWeek of [1, 2]) {
              const inputs = inSeason({ position, gymAccess, offSeason, conditioningTypes, gymSessionsPerWeek });
              const label = `${position}/${gymAccess}/${offSeason ? 'off' : 'in'}/[${conditioningTypes.join('+')}]/gym${gymSessionsPerWeek}`;
              for (const week of generateProgramme(inputs).weeks) {
                for (const s of week.sessions) {
                  if (!s.blocks?.length) problems.push(`${label}: ${s.dayOfWeek} no blocks`);
                  for (const b of s.blocks ?? [])
                    for (const e of b.exercises ?? []) {
                      if (!e.name?.trim()) problems.push(`${label}: blank name in ${b.title}`);
                      if (`${e.sets}`.trim() === '') problems.push(`${label}: blank sets ${e.name}`);
                      if (`${e.reps}`.trim() === '') problems.push(`${label}: blank reps ${e.name}`);
                    }
                  const { dropped, fuzzyMatched } = validateProgrammeSession(s, EXERCISES);
                  dropped.forEach(d => problems.push(`${label}: DROPPED ${d}`));
                  fuzzyMatched.forEach(f => problems.push(`${label}: FUZZY ${f.programmeName}`));
                }
              }
            }
    expect(problems, `\n${problems.slice(0, 25).join('\n')}`).toHaveLength(0);
  });
});
