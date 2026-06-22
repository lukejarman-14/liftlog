// Deterministic football S&C programme generator.
// Identical inputs always produce identical output.

import {
  GeneratedProgramme, ProgrammeInputs, ProgrammeWeek, ProgrammeSession,
  ProgrammeExercise, SessionBlock, ReadinessLevel, MethodType, IntensityIntent,
} from '../types';
import { NAME_TO_ID } from './sessionUtils';
import { DAY_INDEX, capitalize } from './utils';

const ORDERED_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// Remap sessions so every dayOfWeek falls within the user's selected training days.
// No double days: sessions already on an allowed day are locked in first, then
// displaced sessions are spread to the nearest free allowed day.
function remapSessionDays(weeks: ProgrammeWeek[], allowedDayIndices: number[]): ProgrammeWeek[] {
  if (!allowedDayIndices.length) return weeks;
  const sorted = [...allowedDayIndices].sort((a, b) => a - b);

  function nearestFree(idx: number, used: Set<number>): number {
    for (let dist = 0; dist <= 6; dist++) {
      const candidates = sorted.filter(d => {
        const fwd = (d - idx + 7) % 7;
        const bwd = (idx - d + 7) % 7;
        return Math.min(fwd, bwd) === dist && !used.has(d);
      });
      if (candidates.length > 0) return candidates[0];
    }
    // Every allowed day is taken: overflow to any free day of the week rather than
    // double-booking one (preserves the "no double days" guarantee — only a week
    // with >7 sessions, which can't happen, would fall through to a collision).
    const anyFree = ORDERED_DAYS.findIndex((_, i) => !used.has(i));
    return sorted.find(d => !used.has(d)) ?? (anyFree !== -1 ? anyFree : sorted[0]);
  }

  return weeks.map(week => {
    const used = new Set<number>();
    const locked: ProgrammeSession[] = [];
    const displaced: ProgrammeSession[] = [];

    for (const session of week.sessions) {
      if (session.mdDay?.toLowerCase().includes('match')) {
        const idx = ORDERED_DAYS.indexOf(session.dayOfWeek);
        if (idx !== -1) used.add(idx);
        locked.push(session);
        continue;
      }
      const origIdx = ORDERED_DAYS.indexOf(session.dayOfWeek);
      if (origIdx !== -1 && sorted.includes(origIdx) && !used.has(origIdx)) {
        used.add(origIdx);
        locked.push(session);
      } else {
        displaced.push(session);
      }
    }

    const remapped = displaced.map(session => {
      const origIdx = ORDERED_DAYS.indexOf(session.dayOfWeek);
      const newIdx = nearestFree(origIdx === -1 ? 0 : origIdx, used);
      used.add(newIdx);
      return { ...session, dayOfWeek: ORDERED_DAYS[newIdx] };
    });

    return {
      ...week,
      sessions: [...locked, ...remapped].sort(
        (a, b) => ORDERED_DAYS.indexOf(a.dayOfWeek) - ORDERED_DAYS.indexOf(b.dayOfWeek)
      ),
    };
  });
}

// Resolves a display name → library ID using exact + partial lookup only.
// No fuzzy fallback — gaps here are caught by the test suite, not papered over.

function resolveId(name: string): string | undefined {
  const fullKey = name.toLowerCase();
  const key = fullKey.split('(')[0].trim();
  const exactId = NAME_TO_ID[fullKey] ?? NAME_TO_ID[key];
  if (exactId) return exactId;
  for (const [pattern, mappedId] of Object.entries(NAME_TO_ID)) {
    if (key.includes(pattern)) return mappedId;
  }
  return undefined;
}


function ex(
  name: string,
  sets: string,
  reps: string,
  rest: string,
  cue: string,
  opts?: {
    intensity?: string;
    tempo?: string;
    methodType?: MethodType;
    intensityIntent?: IntensityIntent;
    isRunning?: boolean;
  },
): ProgrammeExercise {
  return { name, exerciseId: resolveId(name), sets, reps, rest, cue, ...opts };
}

// score = mean of (sleep + inverted_fatigue + inverted_soreness + inverted_stress) / 4
// sleep: 1=poor → 5=excellent  |  fatigue/soreness/stress: 1=none → 5=severe

export function calcReadiness(r: ProgrammeInputs['readiness']): {
  score: number;
  level: ReadinessLevel;
  guidance: string;
  volumeMultiplier: number;   // applied to set counts
  intensityNote: string;      // appended to exercise intensity labels
} {
  // Default to "high" readiness (3,2,2,2) when not supplied — programme is built as a template,
  // the home-screen daily readiness widget drives per-session adjustments at workout time.
  const safe = r ?? { sleep: 4, fatigue: 2, soreness: 2, stress: 2 };
  // If a 0–100 computed sleep score is available, normalise to 1–5 for the combined formula
  const sleepAs5 = safe.sleepScore100 != null
    ? 1 + (safe.sleepScore100 / 100) * 4
    : safe.sleep;
  // Fatigue: a 0–100 recovery score (100=fresh) maps straight to the 1–5 "freshness"
  // term the formula expects (5=fresh). Otherwise invert the 1–5 fatigue slider (6 - fatigue).
  const fatigueFresh = safe.fatigueScore100 != null
    ? 1 + (safe.fatigueScore100 / 100) * 4
    : 6 - safe.fatigue;
  const raw = (sleepAs5 + fatigueFresh + (6 - safe.soreness) + (6 - safe.stress)) / 4;
  const score = Math.round(raw * 10) / 10;

  if (score >= 4.5) {
    return {
      score, level: 'elite', volumeMultiplier: 1.2,
      guidance: 'Elite readiness. Add a bonus set to every main compound. Chase a PB on your primary lift today — conditions are as good as it gets.',
      intensityNote: '+5% above prescribed',
    };
  }
  if (score >= 3.5) {
    return {
      score, level: 'high', volumeMultiplier: 1.0,
      guidance: 'High readiness. Execute the program as written. Push hard on the big sets — this is the day to drive adaptation.',
      intensityNote: 'as prescribed',
    };
  }
  if (score >= 2.5) {
    return {
      score, level: 'moderate', volumeMultiplier: 0.85,
      guidance: 'Moderate readiness. Complete the program — reduce load by ~10% on main compounds. Monitor RIR and back off if effort spikes unexpectedly.',
      intensityNote: '−10% load',
    };
  }
  return {
    score, level: 'low', volumeMultiplier: 0.70,
    guidance: 'Low readiness. Reduce sets by 1 and drop intensity ~20–25%. Movement quality is the goal today. Strength comes back fast — consistency matters more than grinding today.',
    intensityNote: '−20–25% load, technique focus',
  };
}

export interface TestEmphasis {
  // Extra sets to add to explosive plyometric exercises (CMJ/Depth Jump block)
  plyoSetBoost: 0 | 1 | 2;
  // Extra sets to add to acceleration / sprint exercises
  sprintSetBoost: 0 | 1 | 2;
  // Extra conditioning types to inject if not already selected
  extraCondTypes: Array<'zone2' | 'hiit' | 'rsa'>;
  // Boost RSA interval count (conditioning sessions only)
  rsaIntervalBoost: 0 | 1 | 2;
  // Progress targets faster: applies heavier % loading prescription
  progressFaster: boolean;
  // Human-readable notes shown in coachExplanation
  coachNotes: string[];
}

export function buildTestEmphasis(grades: Partial<Record<string, 1 | 2 | 3 | 4 | 5>> | undefined): TestEmphasis {
  if (!grades || Object.keys(grades).length === 0) {
    return { plyoSetBoost: 0, sprintSetBoost: 0, extraCondTypes: [], rsaIntervalBoost: 0, progressFaster: false, coachNotes: [] };
  }

  // Use the worse of 10m / 30m sprint grades
  const sprintGrade = (grades['10m'] != null && grades['30m'] != null)
    ? Math.min(grades['10m']!, grades['30m']!) as 1|2|3|4|5
    : (grades['10m'] ?? grades['30m'] ?? null);

  const cmjGrade  = grades['cmj']  ?? null;
  const yoyoGrade = grades['yoyo'] ?? null;
  const rsaGrade  = grades['rsa_fi'] ?? grades['rsa'] ?? null;

  const plyoSetBoost:   0|1|2 = cmjGrade === 1 ? 2 : cmjGrade === 2 ? 1 : 0;
  const sprintSetBoost: 0|1|2 = sprintGrade === 1 ? 2 : sprintGrade === 2 ? 1 : 0;
  const rsaIntervalBoost: 0|1|2 = rsaGrade === 1 ? 2 : rsaGrade === 2 ? 1 : 0;

  const extraCondTypes: Array<'zone2' | 'hiit' | 'rsa'> = [];
  if (yoyoGrade !== null && yoyoGrade <= 2) extraCondTypes.push('zone2');
  if (yoyoGrade !== null && yoyoGrade === 1) extraCondTypes.push('hiit');
  if (rsaGrade  !== null && rsaGrade  <= 2) extraCondTypes.push('rsa');

  // Grade 4 or 5 on any quality → progress faster
  const progressFaster = [sprintGrade, cmjGrade, yoyoGrade, rsaGrade].some(g => g != null && g >= 4);

  const GRADE_LABEL = ['', 'Needs Work', 'Fair', 'Good', 'Excellent', 'Elite'] as const;

  const coachNotes: string[] = [];

  if (sprintGrade !== null) {
    const label = GRADE_LABEL[sprintGrade];
    if (sprintGrade <= 2) coachNotes.push(`Sprint grade: ${label} — acceleration volume has been increased (${sprintSetBoost} extra set${sprintSetBoost > 1 ? 's' : ''} per sprint block). Focus on first-step quickness and 0–10m mechanics.`);
    if (sprintGrade === 4) coachNotes.push(`Sprint grade: Excellent — your speed is a clear strength. Intensity progressions are accelerated to keep the stimulus challenging.`);
    if (sprintGrade === 5) coachNotes.push(`Sprint grade: Elite — world-class acceleration. Programmes are set at maximum progression rates to maintain this quality.`);
  }
  if (cmjGrade !== null) {
    const label = GRADE_LABEL[cmjGrade];
    if (cmjGrade <= 2) coachNotes.push(`CMJ grade: ${label} — explosive power volume has been increased (${plyoSetBoost} extra set${plyoSetBoost > 1 ? 's' : ''} in the plyometric block). Prioritise full hip extension and aggressive arm drive.`);
    if (cmjGrade === 4) coachNotes.push(`CMJ grade: Excellent — plyometric targets are set at a higher progression rate to match your power output capacity.`);
    if (cmjGrade === 5) coachNotes.push(`CMJ grade: Elite — exceptional vertical power. Plyometric progressions are set at maximum rate to extend this quality further.`);
  }
  if (yoyoGrade !== null) {
    const label = GRADE_LABEL[yoyoGrade];
    if (yoyoGrade <= 2) {
      const added = extraCondTypes.filter(t => t !== 'rsa').map(t => t === 'zone2' ? 'Zone 2' : 'Hi-Aerobic HIIT').join(' + ');
      coachNotes.push(`Yo-Yo grade: ${label} — aerobic capacity is a priority. ${added ? `${added} conditioning sessions have been added to your schedule.` : 'Conditioning volume has been boosted.'}`);
    }
    if (yoyoGrade === 4) coachNotes.push(`Yo-Yo grade: Excellent — aerobic base is strong. Conditioning sessions target higher-intensity zones to maintain the adaptation.`);
    if (yoyoGrade === 5) coachNotes.push(`Yo-Yo grade: Elite — outstanding aerobic capacity. High-intensity conditioning is prioritised to sustain and extend this standard.`);
  }
  if (rsaGrade !== null) {
    const label = GRADE_LABEL[rsaGrade];
    if (rsaGrade <= 2) coachNotes.push(`RSA / Fatigue Index grade: ${label} — repeated sprint resilience needs work. RSA conditioning has been added${rsaIntervalBoost > 0 ? ` with ${rsaIntervalBoost} extra interval set${rsaIntervalBoost > 1 ? 's' : ''}` : ''}. Focus on maintaining sprint quality into the 4th and 5th rep.`);
    if (rsaGrade === 4) coachNotes.push(`RSA grade: Excellent — your repeated sprint ability is a real asset. Targets are set to extend this quality with higher rep counts and shorter recovery.`);
    if (rsaGrade === 5) coachNotes.push(`RSA grade: Elite — elite-level fatigue resistance. Sprint density and volume are maximised to keep pushing this ceiling.`);
  }

  return { plyoSetBoost, sprintSetBoost, extraCondTypes, rsaIntervalBoost, progressFaster, coachNotes };
}


function durationWeeks(exp: string): number {
  return exp === '<1' ? 6 : exp === '1-3' ? 8 : exp === '3-5' ? 10 : 12;
}

function resolvedDuration(inputs: { experienceYears: string; customDurationWeeks?: number }): number {
  if (inputs.customDurationWeeks && inputs.customDurationWeeks > 0) return inputs.customDurationWeeks;
  return durationWeeks(inputs.experienceYears);
}


function getPhase(week: number, total: number): { phase: string; phaseGoal: string } {
  const p = week / total;
  if (p <= 0.25) return {
    phase: 'Foundation',
    phaseGoal: 'Establish movement quality, build structural resilience, and set a baseline for all physical qualities.',
  };
  if (p <= 0.50) return {
    phase: 'Build',
    phaseGoal: 'Drive progressive overload. Increase positional demands. Accelerate strength and speed adaptation.',
  };
  if (p <= 0.75) return {
    phase: 'Strength & Power',
    phaseGoal: 'Peak force production and explosive output. High neural demand. Maximum velocity sessions are absolute quality.',
  };
  return {
    phase: 'Peak',
    phaseGoal: 'Reduce volume, maximise intensity. Transfer gym output to pitch. Arrive at every match sharper than last week.',
  };
}

// Methodology: mechanical tension (primary hypertrophy driver) requires 48h minimum
// between gym sessions. High-CNS conditioning (RSA) needs 48h from heavy gym.
// Zone 2 is restorative — placed between high-demand sessions with no gap requirements.
// Hi-Aerobic placed after gym (not before) to avoid interference with force production.
//
// 6-session optimal layout (3 gym + 3 conditioning):
//   Mon: Gym Heavy → Tue: Hi-Aerobic → Wed: Gym Moderate → Thu: Zone 2 → Fri: Gym Heavy → Sat: RSA → Sun: Rest
//
// Rationale:
//   • Gym (Heavy) days: Mon & Fri — 96h apart, max mechanical tension stimulus
//   • Gym (Moderate): Wed — 48h from each heavy day, manages DOMS
//   • Hi-Aerobic (Tue): day AFTER Mon gym — aerobic doesn't impair Wed gym recovery
//   • Zone 2 (Thu): restorative — keeps Fri gym fresh, no fatigue contribution
//   • RSA (Sat): 24h after Fri gym, full Sunday rest before Monday cycle restarts

type OsSessionType = 'gym' | 'zone2' | 'hiAerobic' | 'rsa';
type OsSlot = { dayOfWeek: string; load: 'heavy' | 'moderate'; sessionType: OsSessionType };

// Gym-only fallback schedules (used when no conditioningTypes supplied)
const GYM_ONLY_SCHEDULES: Record<number, OsSlot[]> = {
  1: [
    { dayOfWeek: 'Wednesday', load: 'heavy',    sessionType: 'gym' },
  ],
  2: [
    { dayOfWeek: 'Tuesday',   load: 'heavy',    sessionType: 'gym' },
    { dayOfWeek: 'Saturday',  load: 'heavy',    sessionType: 'gym' },
  ],
  3: [
    { dayOfWeek: 'Monday',    load: 'heavy',    sessionType: 'gym' },
    { dayOfWeek: 'Wednesday', load: 'moderate', sessionType: 'gym' },
    { dayOfWeek: 'Saturday',  load: 'heavy',    sessionType: 'gym' },
  ],
  4: [
    { dayOfWeek: 'Monday',    load: 'heavy',    sessionType: 'gym' },
    { dayOfWeek: 'Wednesday', load: 'moderate', sessionType: 'gym' },
    { dayOfWeek: 'Friday',    load: 'heavy',    sessionType: 'gym' },
    { dayOfWeek: 'Sunday',    load: 'moderate', sessionType: 'gym' },
  ],
};

// Builds a week schedule integrating gym + conditioning sessions with optimal spacing.
// Gym sessions placed first on Mon/Wed/Fri (3x) or Tue/Sat (2x) or Mon/Wed/Fri/Sun (4x).
// Conditioning slots fill remaining days following interference/CNS fatigue rules.
function buildMixedOffSeasonSchedule(
  gymCount: number,
  conditioningTypes: ('zone2' | 'hiit' | 'rsa')[],
): OsSlot[] {
  const hasZone2  = conditioningTypes.includes('zone2');
  const hasHiit   = conditioningTypes.includes('hiit');
  const hasRsa    = conditioningTypes.includes('rsa');

  let slots: OsSlot[] = [];

  if (gymCount === 3) {
    // Mon Heavy / Wed Moderate / Fri Heavy — 48h gaps, Heavy-Moderate-Heavy
    slots = [
      { dayOfWeek: 'Monday',    load: 'heavy',    sessionType: 'gym' },
      { dayOfWeek: 'Wednesday', load: 'moderate', sessionType: 'gym' },
      { dayOfWeek: 'Friday',    load: 'heavy',    sessionType: 'gym' },
    ];
    // Tue: Hi-Aerobic — day after Mon gym (aerobic doesn't block Wed recovery)
    if (hasHiit)  slots.push({ dayOfWeek: 'Tuesday',   load: 'moderate', sessionType: 'hiAerobic' });
    // Thu: Zone 2 — restorative between Wed gym and Fri gym, keeps Fri fresh
    if (hasZone2) slots.push({ dayOfWeek: 'Thursday',  load: 'moderate', sessionType: 'zone2' });
    // Sat: RSA — 24h after Fri gym, full Sunday rest before cycle restarts
    if (hasRsa)   slots.push({ dayOfWeek: 'Saturday',  load: 'moderate', sessionType: 'rsa' });
  } else if (gymCount === 2) {
    // Tue Heavy / Sat Heavy — 96h gap, maximum recovery
    slots = [
      { dayOfWeek: 'Tuesday',   load: 'heavy',    sessionType: 'gym' },
      { dayOfWeek: 'Saturday',  load: 'heavy',    sessionType: 'gym' },
    ];
    // Thu: Zone 2 — midpoint between gym days, restorative
    if (hasZone2) slots.push({ dayOfWeek: 'Thursday',  load: 'moderate', sessionType: 'zone2' });
    // Wed: RSA — 24h after Tue gym, 72h before Sat gym
    if (hasRsa)   slots.push({ dayOfWeek: 'Wednesday', load: 'moderate', sessionType: 'rsa' });
    // Sun: Hi-Aerobic — day after Sat gym, Mon rest before Tue gym
    if (hasHiit)  slots.push({ dayOfWeek: 'Sunday',    load: 'moderate', sessionType: 'hiAerobic' });
  } else if (gymCount === 4) {
    // Mon Heavy / Wed Moderate / Fri Heavy / Sun Moderate
    slots = [
      { dayOfWeek: 'Monday',    load: 'heavy',    sessionType: 'gym' },
      { dayOfWeek: 'Wednesday', load: 'moderate', sessionType: 'gym' },
      { dayOfWeek: 'Friday',    load: 'heavy',    sessionType: 'gym' },
      { dayOfWeek: 'Sunday',    load: 'moderate', sessionType: 'gym' },
    ];
    // Tue: Zone 2 — restorative after Mon heavy
    if (hasZone2) slots.push({ dayOfWeek: 'Tuesday',   load: 'moderate', sessionType: 'zone2' });
    // Thu: Hi-Aerobic — between Wed moderate and Fri heavy
    if (hasHiit)  slots.push({ dayOfWeek: 'Thursday',  load: 'moderate', sessionType: 'hiAerobic' });
    // Sat: RSA — after Fri heavy, before Sun moderate (tight but off-season tolerance)
    if (hasRsa)   slots.push({ dayOfWeek: 'Saturday',  load: 'moderate', sessionType: 'rsa' });
  } else {
    return GYM_ONLY_SCHEDULES[gymCount] ?? GYM_ONLY_SCHEDULES[3];
  }

  return slots.sort((a, b) => (DAY_INDEX[a.dayOfWeek] ?? 0) - (DAY_INDEX[b.dayOfWeek] ?? 0));
}


type MdSlot = { mdDay: string; dayOfWeek: string };

const SCHEDULES: Record<string, Record<number, MdSlot[]>> = {
  saturday: {
    // Single in-season session (congested period) — one MD-3 dose: moderate load,
    // mid-week, DOMS clears by match day. NEVER fall through to the 3-session schedule.
    1: [{ mdDay: 'MD-3', dayOfWeek: 'Wednesday' }],
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-2', dayOfWeek: 'Thursday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Sunday' }, { mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
  },
  sunday: {
    1: [{ mdDay: 'MD-3', dayOfWeek: 'Thursday' }],
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-2', dayOfWeek: 'Friday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Monday' }, { mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
  },
  midweek: {
    1: [{ mdDay: 'MD-3', dayOfWeek: 'Sunday' }],
    2: [{ mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    4: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-2', dayOfWeek: 'Monday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
  },
};

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getMdSlots(
  sessionsPerWeek: number,
  matchDay: string,
  secondMatchDay?: string,
): MdSlot[] {
  const schedule = SCHEDULES[matchDay] ?? SCHEDULES.saturday;
  const slots: MdSlot[] = schedule[sessionsPerWeek] ?? schedule[3];

  if (!secondMatchDay) return slots;

  // Normalise to Title Case (inputs may be lowercase e.g. 'tuesday')
  const secondMatchDayTitle = capitalize(secondMatchDay);

  const matchDays = new Set([
    DAY_NAMES.find(d => d.toLowerCase() === matchDay.toLowerCase()) ?? '',
    secondMatchDayTitle,
  ]);

  // For any slot that falls on a match day, shift it one day earlier.
  // If that day is also blocked, shift one more day.
  // If no valid day can be found in the same week, drop the slot entirely.
  return slots
    .map(slot => {
      if (!matchDays.has(slot.dayOfWeek)) return slot;
      const baseIdx = DAY_INDEX[slot.dayOfWeek] ?? 0;
      for (let shift = 1; shift <= 2; shift++) {
        const candidate = DAY_NAMES[(baseIdx - shift + 7) % 7];
        if (!matchDays.has(candidate)) {
          return { ...slot, dayOfWeek: candidate };
        }
      }
      return null; // no safe slot found — drop the session
    })
    .filter((s): s is MdSlot => s !== null);
}

// In-season conditioning slots — placed to protect match-day freshness.
// Rule: Zone 2 can go anywhere (low fatigue cost, even MD-1 is fine).
//       Hi-Aerobic and RSA must be MD-3 or earlier — high fatigue risks injury if closer to match.
const IN_SEASON_COND_SLOTS: Record<string, Record<'zone2' | 'hiAerobic' | 'rsa', MdSlot>> = {
  saturday: {
    zone2:     { mdDay: 'zone 2',        dayOfWeek: 'Sunday' },    // MD+1 — active recovery
    hiAerobic: { mdDay: 'high aerobic',  dayOfWeek: 'Thursday' },  // MD-2
    rsa:       { mdDay: 'rsa',           dayOfWeek: 'Monday' },    // MD-5
  },
  sunday: {
    zone2:     { mdDay: 'zone 2',        dayOfWeek: 'Monday' },    // MD+1
    hiAerobic: { mdDay: 'high aerobic',  dayOfWeek: 'Thursday' },  // MD-3
    rsa:       { mdDay: 'rsa',           dayOfWeek: 'Tuesday' },   // MD-5
  },
  midweek: {
    zone2:     { mdDay: 'zone 2',        dayOfWeek: 'Thursday' },  // MD+1
    hiAerobic: { mdDay: 'high aerobic',  dayOfWeek: 'Sunday' },    // MD-3
    rsa:       { mdDay: 'rsa',           dayOfWeek: 'Saturday' },  // MD-4 (MD-5 = Friday previous week — impractical)
  },
};

// Balanced: MD-4 = strength end; MD-3 = speed end; MD-2 = middle of curve

function getFVProfile(mdDay: string): {
  profile: string;
  loadScheme: 'heavy' | 'moderate' | 'light';
  repRange: 'low' | 'medium' | 'high';
} {
  if (mdDay === 'MD-4') return {
    profile: 'Heavy load · low reps · explosive intent',
    loadScheme: 'heavy', repRange: 'low',
  };
  if (mdDay === 'MD-3') return {
    profile: 'Moderate load · eccentric tempo · DOMS clears by match day',
    loadScheme: 'moderate', repRange: 'medium',
  };
  if (mdDay === 'MD-2') return {
    profile: 'Micro-dosed power only · no fatigue carryover',
    loadScheme: 'moderate', repRange: 'medium',
  };
  return {
    profile: 'Neural priming · light load · max velocity · zero fatigue',
    loadScheme: 'light', repRange: 'medium',
  };
}


const WARMUP_MOBILITY = [
  ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Drive lead knee toward the floor. Breathe into end range — never force it.',
    { methodType: 'isometric', intensityIntent: 'controlled' }),
  ex("World's Greatest Stretch", '1', '5 each side', '', 'Lunge forward, thoracic rotation, reach ceiling. Eyes follow the hand.',
    { methodType: 'mixed', intensityIntent: 'controlled' }),
  ex('Glute Bridge Hold + March', '1', '8 each leg', '30s', 'Drive hips to full extension and squeeze both glutes hard — lock the bridge. Now march: lift one knee to your chest while keeping your hips PERFECTLY level on the standing leg. If your hip drops or rotates, the glute medius has switched off — reset and start again. Slow and deliberate, 8 reps per leg. The glute medius is the hip stabiliser that stops your knee caving inward on every sprint, cut, and landing.',
    { methodType: 'isometric', intensityIntent: 'controlled', tempo: '1-2-1-0' }),
];

const WARMUP_NEURAL = [
  ex('Lateral Shuffle (Warmup)', '2', '15 steps each way', '30s', 'Stay low — hips below shoulders. Push off outside foot each step. Do not cross feet. Groin activation and lateral movement prep.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
  ex('A-Skip', '2', '2 × 20m', '30s', 'Knee to hip height. Claw foot back down. Tall posture, relaxed shoulders.',
    { intensityIntent: 'moderate' }),
  ex('High Knees', '2', '20m', '20s', 'Punch knees fast. Land ball of foot. Rapid arm action.',
    { intensityIntent: 'moderate' }),
];

const WARMUP_STRENGTH = [
  ex('Air Squat (Activation)', '2', '10', '30s', 'Elbows inside knees at the bottom. Drive knees out. Full depth. No equipment needed — bodyweight only.',
    { methodType: 'concentric', intensityIntent: 'controlled', tempo: '3-0-1-0' }),
  ex('Prone T-Y-I (Scapular Activation)', '2', '8 each shape', '20s', 'Lie face down. For T: arms out to sides, thumbs up. Y: arms 45° overhead. I: arms overhead. Squeeze shoulder blades on each rep. No equipment needed — scapular stability for every training environment.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
];

// Science: concentric compound lifts ONLY here. Eccentrics are in ECCENTRIC_BLOCK (always last).
// Sets: 2–3 max (athlete-specific volume). Load: 80%+ Foundation → 85%+ Build → 88%+ S&P → 90%+ Peak.
// Bar speed autoregulation: stop any set when velocity drops >20% vs set 1 — that is the daily ceiling.

type GymKey = 'full' | 'basic' | 'none';
type LoadKey = 'heavy' | 'moderate';

// Periodization removed from the lifting blocks — strength + upper run as one flat
// block every week, and progressive overload (progressiveOverload.ts) drives the
// week-to-week load increase. We pin every lifting-library lookup to this single
// canonical block. Foundation is used because it carries no Sled Push and no
// Push Press (so those are dropped automatically) and its rep ranges leave the most
// room for the continuous load ramp. Cardio still uses the real phase (future work).
const LIFT_PHASE = 'Foundation';

const STRENGTH_LIBRARY: Record<string, Record<GymKey, Record<LoadKey, ProgrammeExercise[]>>> = {
  Foundation: {
    full: {
      heavy: [
        ex('Back Squat', '3', '4', '3:00', 'Vertical force developer — knee extensors, quads dominant. Full depth. Explosive concentric. 2–1 RIR: bar moves with intent but not a grind. 4 reps keeps every rep effective.',
          { intensity: '82% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Hip Thrust (Barbell)', '3', '5', '2:30', 'HORIZONTAL force developer — glutes and hamstrings produce the same hip-extension vector as a sprint push-off. Squats train vertical; this trains the motor units that actually accelerate you horizontally. Full extension. 1s hold at top. 2 RIR.',
          { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Trap Bar Deadlift', '2', '4', '3:00', 'Hip-hinge — bridges vertical and horizontal patterns. Drive floor away. Hips and shoulders rise simultaneously.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Back Squat', '3', '5', '2:30', 'Full depth. Consistent bar path. Explosive drive up. 3–2 RIR.',
          { intensity: '78% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Hip Thrust (Barbell)', '2', '5', '2:30', 'Horizontal hip extension. Glute and hamstring motor units used in sprinting. Full extension every rep.',
          { intensity: '75% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ],
    },
    basic: {
      heavy: [
        ex('Barbell Back Squat', '3', '5', '3:00', 'Full depth. Drive knees out. Explosive concentric — treat it like a competition attempt. 2–1 RIR.',
          { intensity: '80% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '3', '5', '2:30', 'Shoulders on bench. Barbell across hips (use pad). Full hip extension. 1s hold at top. Horizontal force — sprint motor units.',
          { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Romanian Deadlift (Concentric Focus)', '2', '5', '2:30', 'Hinge to mid-shin — drive hips through powerfully. Focus on the hip extension. 2 RIR.',
          { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Barbell Back Squat', '3', '6', '2:30', 'Full depth. Consistent bar path. Explosive drive up. 3–2 RIR.',
          { intensity: '75% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Barbell Hip Thrust', '2', '6', '2:00', 'Full hip extension. Glute drive. 3 RIR.',
          { intensity: '72% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat (Box Assisted)', '2', '4 @ 1 RIR', '3:00', 'Box at parallel. Drive through heel. Explosive concentric. No external load — 1 RIR = 1 rep from failure. 4 reps keeps every rep effective — no junk volume.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '4 @ 1 RIR', '2:30', 'Shoulders on bench. Non-working leg raised. 1 RIR — with bodyweight, RIR is the load variable. Sprint motor units (glute/ham) trained horizontally. Full hip extension every rep.',
          { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Step-Up (High Box)', '2', '5 each', '2:00', 'Drive through working leg only. Explosive step. No push from trailing foot.',
          { methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Pistol Squat (Box)', '2', '4 @ 2 RIR', '2:30', 'Box for depth reference. 2 RIR — 2 reps from failure. Drive explosively. With bodyweight, RIR is the intensity variable.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '6 each', '90s', 'Full hip extension. Drive hips through hard every rep. 2 RIR — close enough to make it count.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
  },
  Build: {
    full: {
      heavy: [
        ex('Back Squat', '3', '3', '3:30', 'Vertical force. Brace maximally. Attack depth. Treat every rep as a competition attempt. 2–1 RIR — bar is moving with intent but no grinding.',
          { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Sled Push', '3', '20m', '3:00', 'HORIZONTAL force — the most sprint-specific strength exercise available. Drive from a low body angle, powerful hip extension with every step. If you only squat, you never train the motor units used to accelerate horizontally. Load: heavy enough that you cannot run — this is a strength exercise, not conditioning.',
          { intensity: 'Heavy — controlled push', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Hip Thrust (Barbell)', '2', '4', '2:30', 'Horizontal hip extension. Glute/hamstring motor units = sprint motor units. 1s hold at top. 2 RIR. If bar velocity drops on rep 3, rack and rest.',
          { intensity: '83% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Back Squat', '3', '4', '3:00', 'High intent. Consistent depth. Fast concentric. 3–2 RIR.',
          { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Sled Push', '2', '20m', '2:30', 'Horizontal force — sprint-specific. Moderate load. Drive hips through on every step.',
          { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Hip Thrust (Barbell)', '2', '4', '2:30', 'Horizontal hip extension. Glute drive. Full extension.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ],
    },
    basic: {
      heavy: [
        ex('Barbell Back Squat', '3', '4', '3:30', 'Vertical force — brace maximally, attack depth. Every rep treated as a competition attempt. 2–1 RIR.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '3', '4', '3:00', 'Heavy barbell across hips. Full hip extension. 1s hold at top. Sprint motor units — horizontal force.',
          { intensity: '83% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Romanian Deadlift (Concentric Focus)', '2', '4', '2:30', 'Hinge to mid-shin — drive hips through powerfully. Focus on hip extension. 2 RIR.',
          { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Barbell Back Squat', '3', '5', '3:00', 'High intent. Consistent depth. Fast concentric. 3–2 RIR.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Barbell Hip Thrust', '2', '5', '2:30', 'Horizontal force. Strong hip extension. 3 RIR.',
          { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Barbell Romanian Deadlift', '2', '5', '2:30', 'Hinge to mid-shin — drive hips through powerfully. 3–2 RIR.',
          { intensity: '76% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat', '2', '4 @ 1 RIR', '3:00', 'Full depth. 2s descent. Explosive concentric. 1 RIR — bodyweight max strength requires proximity to failure. 4 reps, all effective. No fingertip support unless essential.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '4 @ 1 RIR', '2:30', 'Explosive hip drive. Full extension. 1 RIR — horizontal hip extension at max output. Sprint motor units.',
          { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Step-Up (High Box)', '2', '5 each', '2:00', 'Drive through working leg only. Max intent.',
          { methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Pistol Squat', '2', '4 @ 2 RIR', '2:30', 'Full depth. Explosive drive up. 2 RIR — near maximal.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '6 each', '2:00', 'Full hip extension. Drive hips hard. 2 RIR.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
  },
  'Strength & Power': {
    full: {
      heavy: [
        ex('Back Squat', '3', '2', '4:00', 'Vertical force — peak neural output. Maximum drive every rep. 1 RIR — bar is slow but technically sound. Do not compress rest.',
          { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Sled Push (Heavy)', '3', '15m', '3:30', 'Peak horizontal force output. Heaviest load you can push with full hip extension each step. Drive from the hip — this is your sprint acceleration expressed as a strength movement. 1 RIR.',
          { intensity: 'Maximum controllable load', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Hip Thrust (Barbell)', '2', '3', '3:00', 'Peak horizontal hip extension. 2–1 RIR. If bar doesn\'t move with intent on rep 2, rack and rest. The glute/hamstring motor units here are the same ones producing your sprint peak force.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Back Squat', '3', '3', '3:30', 'High intent. Maximum concentric speed. 2 RIR.',
          { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Sled Push', '2', '15m', '3:00', 'Horizontal force. Strong hip extension each step. Moderate-heavy load.',
          { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Hip Thrust (Barbell)', '2', '3', '2:30', 'Horizontal hip extension. Full extension. 2 RIR.',
          { intensity: '83% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
    basic: {
      heavy: [
        ex('Barbell Back Squat', '3', '3', '4:00', 'Vertical force — peak neural output. Maximum drive every rep. 1 RIR.',
          { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '3', '4', '3:00', 'Peak horizontal hip extension. Heavy barbell. 1s hold at top. 2–1 RIR. Sprint motor units.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Romanian Deadlift (Concentric Focus)', '2', '4', '2:30', 'Hip hinge — drive through powerfully. 2 RIR. Peak loading.',
          { intensity: '84% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Barbell Back Squat', '3', '4', '3:30', 'High intent. Maximum concentric speed. 2 RIR.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '2', '4', '2:30', 'Horizontal force. Full extension. 2 RIR.',
          { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Romanian Deadlift', '2', '4', '2:30', 'Hinge to mid-shin — drive hips through powerfully. 2 RIR.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat', '3', '4 @ 1 RIR', '3:00', 'Full depth. 2s descent. Explosive concentric. 1 RIR — bodyweight max strength requires proximity to failure. No fingertip support unless essential.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '4 @ 1 RIR', '2:30', 'Explosive hip drive. Full extension. 1 RIR — horizontal hip extension at max output.',
          { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Step-Up (High Box)', '2', '5 each', '2:00', 'Drive through working leg only. Max intent.',
          { methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Pistol Squat', '2', '4 @ 2 RIR', '2:30', 'Full depth. Explosive drive up. 2 RIR.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '6 each', '2:00', 'Full hip extension. Drive hips through hard. 2 RIR.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
  },
  Peak: {
    full: {
      heavy: [
        ex('Back Squat', '2', '2', '4:00', 'Express peak vertical strength. Near-maximum. 1–0 RIR. Non-negotiable rest.',
          { intensity: '93% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Sled Push — Speed Variant', '2', '15m', '4:00', 'Peak-week: moderate load, maximum push speed. Transfer horizontal strength to pitch. Full hip extension every step. Express what you built.',
          { intensity: 'Moderate — max sprint pace', methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Hip Thrust (Barbell)', '2', '3', '3:00', 'Peak horizontal hip extension. 2–1 RIR. Express sprint-specific force.',
          { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Back Squat', '2', '3', '4:00', 'High quality. Full rest. Max intent. 2 RIR.',
          { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Hip Thrust (Barbell)', '2', '3', '3:00', 'Peak horizontal hip extension. Quality over volume. 2 RIR.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
    basic: {
      heavy: [
        ex('Barbell Back Squat', '2', '3', '4:00', 'Express peak vertical strength. Near-maximum. 1–0 RIR. Non-negotiable rest.',
          { intensity: '91% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '2', '3', '3:00', 'Peak horizontal hip extension. Heavy barbell. 2–1 RIR. Express sprint-specific force.',
          { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Romanian Deadlift', '2', '3', '3:00', 'Peak hip hinge. Drive hips through hard. 1–2 RIR.',
          { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Barbell Back Squat', '2', '4', '4:00', 'High quality. Full rest. Max intent. 2 RIR.',
          { intensity: '86% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Barbell Hip Thrust', '2', '4', '3:00', 'Horizontal force. Quality over volume. 2 RIR.',
          { intensity: '84% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat — Max Expression', '2', '3 @ 1 RIR', '3:00', 'Full depth. Explosive concentric. 1 RIR. Express peak bodyweight strength — low volume, maximum quality.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Hip Thrust', '2', '4 @ 1 RIR', '2:30', 'Max hip extension. 1 RIR. Express horizontal strength.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Pistol Squat', '2', '4 @ 2 RIR', '2:30', 'Controlled descent. Explosive drive. 2 RIR.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Single-Leg Hip Thrust', '2', '4 @ 1 RIR', '2:00', 'Explosive hip extension. 1 RIR — peak quality.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
    },
  },
};

// Replaces Back Squat when: speed primary goal | in-season | back/hamstring injury.
// Same phase structure as STRENGTH_LIBRARY — single exercise per slot.

const BSS_LIBRARY: Record<string, Record<GymKey, Record<LoadKey, ProgrammeExercise>>> = {
  Foundation: {
    full: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '5 each', '3:00',
        'Rear foot elevated on bench. Heaviest DBs available — one in each hand. 2s eccentric descent, explosive drive up. Full depth — front knee tracks over toes. Single-leg vertical force: loads hip flexors and quads independently, exposes asymmetries. 2–1 RIR. Sprint carryover is higher than bilateral squat due to unilateral loading angle.',
        { intensity: '80% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '6 each', '2:30',
        'Rear foot elevated. Full depth. Explosive concentric. Consistent rep quality throughout. 3–2 RIR.',
        { intensity: '75% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '5 each', '3:00',
        'Rear foot on bench. DBs in each hand. 2s descent. Explosive drive. 2–1 RIR. Load both legs evenly in the warm-up set — one side is usually weaker.',
        { intensity: '80% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '6 each', '2:30',
        'Full depth. Explosive concentric. 3–2 RIR.',
        { intensity: '75% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    none: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '5 each @ 1 RIR', '2:30',
        'Heaviest DBs available. Rear foot elevated. Full depth. Drive through front heel. 1 RIR — close to failure.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (BW)', '3', '8 each @ 2 RIR', '2:00',
        'Rear foot elevated. Controlled descent. Explosive drive. Add a backpack for load if needed.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
  Build: {
    full: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '4 each', '3:30',
        'Rear foot elevated. Heavy load — 85% of your BSS working weight. 2s descent, violent concentric. 2–1 RIR. Every rep a competition attempt. Sprint force development: unilateral loading replicates the single-leg push-off mechanics of acceleration.',
        { intensity: '85% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '5 each', '3:00',
        'Rear foot elevated. Consistent depth. Explosive concentric. 3–2 RIR.',
        { intensity: '80% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '4 each', '3:30',
        'Heavy DBs, rear foot on bench. 2s descent. Maximum concentric intent. 2–1 RIR.',
        { intensity: '83% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '5 each', '3:00',
        'Full depth. Explosive drive. 3–2 RIR.',
        { intensity: '80% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    none: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '4 each @ 1 RIR', '3:00',
        'Heaviest DBs available. Rear foot elevated. Full depth. Drive through front heel. 1 RIR.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '2', '6 each @ 2 RIR', '2:30',
        'Moderate DB load. Controlled descent. Explosive drive. 2 RIR.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
  'Strength & Power': {
    full: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '3 each', '4:00',
        'Heavy — 88% working weight. 2s descent, maximum concentric velocity intent. 1 RIR. Peak force expression on a unilateral pattern. Bar should move with authority. Do not compress rest.',
        { intensity: '88% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '4 each', '3:30',
        'High intent. Explosive concentric. 2 RIR.',
        { intensity: '84% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '3 each', '4:00',
        'Peak load DBs. 1 RIR — reps are slow but technically sound. Do not rush.',
        { intensity: '87% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '3', '4 each', '3:30',
        'Explosive concentric. 2 RIR.',
        { intensity: '84% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    none: {
      heavy: ex('Bulgarian Split Squat (DB)', '3', '3 each @ 1 RIR', '3:30',
        'Heaviest DBs available. 1 RIR — proximate to failure. Explosive drive.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '2', '5 each @ 2 RIR', '3:00',
        'Controlled. Explosive concentric. 2 RIR.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
  Peak: {
    full: {
      heavy: ex('Bulgarian Split Squat (DB)', '2', '3 each', '4:00',
        'Peak expression. Low volume, maximal quality. 1–0 RIR. Non-negotiable rest between sets and legs. Do not rush.',
        { intensity: '90% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '2', '4 each', '3:30',
        'Quality over volume. Max intent every rep. 2 RIR.',
        { intensity: '86% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Bulgarian Split Squat (DB)', '2', '3 each', '4:00',
        'Peak quality. 1–0 RIR. Full rest between sets.',
        { intensity: '89% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '2', '4 each', '3:30',
        'Quality execution. Max intent. 2 RIR.',
        { intensity: '86% 1RM equiv.', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    none: {
      heavy: ex('Bulgarian Split Squat (DB)', '2', '3 each @ 1 RIR', '3:30',
        'Heaviest available DBs. Peak expression. 1 RIR.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Bulgarian Split Squat (DB)', '2', '4 each @ 2 RIR', '3:00',
        'Quality. Explosive drive. 2 RIR.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
};

// Used for box-to-box, press-heavy, counter-attack when gym access includes a barbell.
// Replaces the vertical squat slot (slot 1 in Max Strength block).
const TRAP_BAR_LIBRARY: Record<string, Record<string, Record<LoadKey, ProgrammeExercise>>> = {
  Foundation: {
    full: {
      heavy: ex('Trap Bar Deadlift', '3', '4', '3:00',
        'Primary lower compound. Hip hinge from neutral grip — hips and shoulders rise simultaneously. Drive the floor away with full hip extension. Bridges squat and deadlift patterns. 2–1 RIR. Every rep explosive concentric.',
        { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '3', '5', '2:30',
        'Foundation moderate. Neutral grip, hip-hinge pattern. Controlled descent, explosive drive. 3–2 RIR. Consistent mechanics — build the pattern before loading.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    },
    basic: {
      heavy: ex('Trap Bar Deadlift', '3', '4', '3:00',
        'Primary lower compound. Hip hinge — drive floor away. 2–1 RIR. Explosive concentric every rep.',
        { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '3', '5', '2:30',
        'Controlled hip hinge. 3–2 RIR. Build pattern quality.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    },
  },
  Build: {
    full: {
      heavy: ex('Trap Bar Deadlift', '3', '3', '3:30',
        'Build phase — push load. 87% 1RM. Brace maximally, drive hips through hard. 1–0 RIR on each rep. Bar speed is your autoregulation signal.',
        { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '3', '4', '3:00',
        'Build moderate. High intent on every rep. 2 RIR. Consistent hip extension pattern.',
        { intensity: '83% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    },
    basic: {
      heavy: ex('Trap Bar Deadlift', '3', '3', '3:30',
        'Heavy trap bar. Brace, hinge, drive. 1–0 RIR.',
        { intensity: '86% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '3', '4', '3:00',
        'Controlled load. Max intent. 2 RIR.',
        { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    },
  },
  'Strength & Power': {
    full: {
      heavy: ex('Trap Bar Deadlift', '3', '3', '3:30',
        'Strength & Power — near maximal. 90% 1RM. Explosive from the floor. If bar slows on rep 2, that is fine — fight it. 1 RIR.',
        { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '2', '4', '3:00',
        'Moderate — quality over volume in peak strength phase. 2 RIR. Full hip extension.',
        { intensity: '86% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Trap Bar Deadlift', '3', '3', '3:30',
        'Near maximal. 1 RIR. Full drive through.',
        { intensity: '89% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '2', '4', '3:00',
        'Quality over volume. 2 RIR.',
        { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
  Peak: {
    full: {
      heavy: ex('Trap Bar Deadlift', '2', '3', '4:00',
        'Peak expression — low volume, maximum quality. 1–0 RIR. Do not rush: full reset between reps. Express the strength built across the programme.',
        { intensity: '92% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '2', '3', '3:30',
        'Peak moderate. Quality maintenance. 2 RIR.',
        { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
    basic: {
      heavy: ex('Trap Bar Deadlift', '2', '3', '4:00',
        'Peak quality. 1–0 RIR. Full hip extension, full reset.',
        { intensity: '91% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      moderate: ex('Trap Bar Deadlift', '2', '3', '3:30',
        'Maintain quality. 2 RIR.',
        { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    },
  },
};

// Play styles that use Trap Bar Deadlift as the primary lower compound
// (horizontal force base for acceleration, repeated sprints, and press triggers)
const TRAP_BAR_PLAY_STYLES = new Set(['box-to-box', 'press-heavy', 'counter-attack']);

/**
 * Returns true → use Back Squat as vertical compound.
 * Returns false → use Bulgarian Split Squat.
 *
 * BSS always wins when:
 *   - Primary goal is speed (sprint mechanics favoured)
 *   - In-season / no offSeason flag (fatigue management)
 *   - Back or hamstring injury history (structural risk)
 *
 * Back Squat eligible when:
 *   - Off-season Foundation phase (General Strength) AND no injury overrides, OR
 *   - Player prefers Back Squat (plateau on single-leg / psychology) AND off-season AND no injury overrides
 */
function useBackSquat(inputs: ProgrammeInputs): boolean {
  if (inputs.gymAccess === 'none') return false; // no barbell = impossible
  // Injury override always wins — structural safety:
  if (inputs.injuryHistory.some(a => a === 'back' || a === 'hamstring')) return false;
  // Explicit player opt-in overrides season type and goal:
  if (inputs.preferBackSquat) return true;
  // Default: Back Squat only in off/pre-season Foundation, not speed-focused:
  if (inputs.primaryGoal === 'speed') return false;
  if (!inputs.offSeason) return false; // in-season → BSS by default
  return false;
}

/** Select primary lower compound — Trap Bar, Back Squat, or BSS — based on play style and athlete context. */
function selectVerticalSquat(
  inputs: ProgrammeInputs,
  _phase: string,
  gymKey: GymKey,
  loadScheme: LoadKey,
  strengthEx: ProgrammeExercise[],
): ProgrammeExercise {
  // Trap Bar replaces the squat for acceleration / horizontal-force play styles,
  // but never overrides an explicit player opt-in for Back Squat.
  if (TRAP_BAR_PLAY_STYLES.has(inputs.playStyle) && gymKey === 'full' && !inputs.preferBackSquat) {
    const tbPhase = TRAP_BAR_LIBRARY[LIFT_PHASE];
    const tbGym = tbPhase[gymKey] ?? tbPhase.basic;
    return (tbGym[loadScheme] ?? tbGym.moderate) as ProgrammeExercise;
  }
  if (useBackSquat(inputs)) {
    return strengthEx[0]; // Back Squat from STRENGTH_LIBRARY
  }
  const bssPhase = BSS_LIBRARY[LIFT_PHASE];
  const bssGym = bssPhase[gymKey] ?? bssPhase.basic;
  return bssGym[loadScheme] ?? bssGym.moderate;
}

/** Force every exercise in a block to intensityIntent: 'maximal'. */
function forceMaximal(exercises: ProgrammeExercise[]): ProgrammeExercise[] {
  return exercises.map(e => ({ ...e, intensityIntent: 'maximal' as IntensityIntent }));
}

/**
 * Builds a max-strength sequence of exactly up to 5 exercises.
 * Hard ratio: max 3 lower body, max 2 upper body.
 * Interleaved so each muscle group recovers while the other works:
 *   1. Vertical lower  (squat / BSS)          — lower 1/3
 *   2. Upper push      (bench / press)         — upper 1/2
 *   3. Horizontal lower (hip thrust / sled)    — lower 2/3
 *   4. Upper pull      (row / pull-up)         — upper 2/2
 *   5. Lower fill      (play-style / weakness) — lower 3/3
 * Slot 5 is always a lower-body fill — a 3rd upper exercise is never added.
 * All exercises forced to maximal intent.
 */
function buildMaxStrengthBlock(
  vertical: ProgrammeExercise,
  horizontal: ProgrammeExercise | undefined,
  upperEx: ProgrammeExercise[],
  fill: ProgrammeExercise[],
): ProgrammeExercise[] {
  // Strip only movements that don't belong in a strength block (sprints, slow eccentrics,
  // heavy isometrics). Reactive / plyometric fill IS allowed — it adds explosive variety.
  const cleanFill = fill.filter(
    e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning,
  );
  const sequence: (ProgrammeExercise | undefined)[] = [
    vertical,      // lower 1 — vertical compound
    upperEx[0],    // upper 1 — push (lower recovers)
    horizontal,    // lower 2 — horizontal compound (upper recovers)
    upperEx[1],    // upper 2 — pull (lower recovers)
    cleanFill[0],  // lower 3 — play-style / weakness fill (never a 3rd upper)
  ];
  return forceMaximal(sequence.filter((e): e is ProgrammeExercise => e !== undefined).slice(0, 5));
}

// Each sub-array = one week's pair. Rotated by weekNum % pool.length.
// Low reps (2–3), full 3 min rest. Max CNS output every rep.
const EXPLOSIVE_PLYO_POOL: Record<GymKey, ProgrammeExercise[][]> = {
  full: [
    // Week 1 — vertical + horizontal
    [
      ex('Box Jump', '3', '2', '1:30', 'Drive arms, explode onto box. Land softly in partial squat. Step down every time — never jump down. Full rest before next rep.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement every rep. Load hips, drive arms hard. Stick the landing — absorb with hips and knees. Full CNS reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 2 — vertical + horizontal
    [
      ex('Countermovement Jump', '3', '2', '1:30', 'Arms back, deep dip, drive hard through the ceiling. Max height every rep. Full CNS reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Lateral Bound', '3', '3 each side', '1:30', 'Single-leg lateral push, stick the landing on the opposite leg. Max lateral displacement. Replicates change-of-direction power.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 3 — vertical + horizontal
    [
      ex('Depth Jump', '3', '2', '1:30', 'Step off box, hit the ground, immediately explode up. Ground contact as brief as possible — this is reactive strength, not a squat. Full rest between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement. Load hips, drive arms, push the ground back hard. Stick the landing. Full reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  ],
  basic: [
    // Week 1 — vertical + horizontal
    [
      ex('Box Jump', '3', '2', '1:30', 'Drive arms, explode onto box. Land softly in partial squat. Step down every time — never jump down. Full rest before next rep.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement every rep. Drive arms, load hips, push the ground back hard. Stick the landing. Full reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 2 — vertical + horizontal
    [
      ex('Countermovement Jump', '3', '2', '1:30', 'Arms back, deep dip, drive hard through the ceiling. Max height every rep. Full CNS reset.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Lateral Bound', '3', '3 each side', '1:30', 'Single-leg lateral push, stick the landing on the opposite leg. Max lateral displacement. Replicates change-of-direction power.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 3 — vertical + horizontal
    [
      ex('Depth Jump', '3', '2', '1:30', 'Step off box, hit the ground, immediately explode up. Ground contact as brief as possible. Full rest between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement. Load hips, drive arms, push the ground back hard. Stick the landing. Full reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  ],
  none: [
    // Week 1 — vertical + horizontal
    [
      ex('Countermovement Jump', '3', '2', '1:30', 'Arms back, deep dip, drive hard through the ceiling. Max height every rep. Full CNS reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement. Swing arms, load hips, drive. Stick the landing. Full reset between every rep.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 2 — vertical + horizontal
    [
      ex('Squat Jump', '3', '2', '1:30', 'No countermovement — drop into quarter squat, pause 1s, explode up. Pure concentric power. Max height every rep.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Lateral Bound', '3', '3 each side', '1:30', 'Single-leg lateral push, stick the landing on the opposite leg. Max lateral displacement. Replicates change-of-direction power.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    // Week 3 — vertical + horizontal
    [
      ex('Depth Jump', '3', '2', '1:30', 'Step off a low step or curb, hit the ground, immediately explode up. Ground contact as brief as possible. Full rest between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Broad Jump', '3', '2', '1:30', 'Max horizontal displacement. Load hips, drive arms. Stick the landing. Full reset between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  ],
};

function pickExplosivePlyo(gymKey: GymKey, weekNum: number): ProgrammeExercise[] {
  const pool = EXPLOSIVE_PLYO_POOL[gymKey];
  return pool[weekNum % pool.length];
}

// Pogo hops and variations. Tendon-spring / SSC training after max strength.
const REACTIVE_PLYO_POOL: Record<GymKey, ProgrammeExercise[][]> = {
  full: [
    [ex('Pogo Hops', '3', '20', '90s', 'Ankles STIFF — no dorsiflexion. Arms punch up. Minimum ground contact time. Tendon spring at match-speed loading rate.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Lateral Ankle Hops', '3', '20 each direction', '90s', 'Rapid side-to-side hops off both feet. Stiff ankles throughout. Stay on balls of feet — no heel contact. Trains lateral SSC spring.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Single-Leg Pogo Hops', '3', '12 each leg', '90s', 'Same stiff-ankle mechanics as double-leg pogos, one leg only. Unilateral SSC spring — directly loads the Achilles as in sprinting.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Skipping (Fast Cadence)', '3', '20m', '90s', 'Maximal frequency skipping — knee drives fast, short ground contact. Ball of foot only. Neural speed training: same high-cadence CNS demand as sprinting.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
  ],
  basic: [
    [ex('Pogo Hops', '3', '20', '90s', 'Ankles STIFF — no dorsiflexion. Arms punch up. Minimum ground contact time. Tendon spring at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Lateral Ankle Hops', '3', '20 each direction', '90s', 'Rapid side-to-side hops. Stiff ankles, stay on balls of feet. Lateral SSC spring.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Single-Leg Pogo Hops', '3', '12 each leg', '90s', 'One-leg stiff-ankle hops. Unilateral Achilles SSC spring — matches sprinting load pattern.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Skipping (Fast Cadence)', '3', '20m', '90s', 'Max frequency skipping. Knee drives fast, short ground contact. Ball of foot only. High-cadence CNS stimulus.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
  ],
  none: [
    [ex('Pogo Hops', '3', '20', '90s', 'Ankles stiff. Minimum ground contact. Elastic SSC tendon return at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Lateral Ankle Hops', '3', '20 each direction', '90s', 'Rapid side-to-side hops. Stiff ankles, balls of feet. Lateral SSC spring.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Single-Leg Pogo Hops', '3', '12 each leg', '90s', 'One-leg stiff-ankle hops. Unilateral Achilles SSC spring.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
    [ex('Skipping (Fast Cadence)', '3', '20m', '90s', 'Max frequency skipping. Short ground contact, ball of foot. High-cadence neural stimulus.',
      { methodType: 'reactive', intensityIntent: 'reactive' })],
  ],
};

function pickReactivePlyo(gymKey: GymKey, weekNum: number): ProgrammeExercise[] {
  const pool = REACTIVE_PLYO_POOL[gymKey];
  return pool[weekNum % pool.length];
}

// Science: tendon stiffness = heavy slow resistance isometrics + fast reactive plyometrics (short GCT).
// Placed AFTER strength (not fatigued by strength), BEFORE eccentrics.
// Heavy isometrics → tendon structural adaptation. Pogo hops → fast SSC tendon spring.

// Tendon physiology: Heavy Slow Resistance (HSR) isometrics → increased tendon stiffness → tendon
// absorbs more of the sprint/jump load, so the muscle doesn't overwork → reduced patellar + Achilles risk.
// Two HSR exercises per session: one patellar-tendon dominant (split squat), one Achilles-dominant (calf hold).
// Pogo hops = fast SSC — trains the tendon spring at match-speed loading rates.
const TENDON_SSC_BLOCK: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Isometric Split Squat Hold (Heavy)', '1', '10-12s each leg', '90s', 'Bottom of split squat — rear knee 2cm from floor. Add load via barbell or heavy DB. Maximum effort throughout — zero relaxing. Patellar tendon HSR: brief maximal holds at ≥90% MVC optimise tendon stiffness. Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '1', '8-10s each leg', '90s', 'Rise onto single-leg tiptoe. Hold at the top. Add weight via DB or barbell if available. Maximum effort. Achilles tendon HSR — brief ≥90% MVC holds maximise Achilles stiffness adaptation. Tendon stiffness driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Ankles STIFF — no dorsiflexion. Arms punch up. Minimum ground contact time. High frequency tendon-spring training: the isometric holds above build stiffness, pogos train the elastic SSC return at match-speed loading rate.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  basic: [
    ex('Isometric Split Squat Hold (Heavy DB)', '1', '10-12s each leg', '90s', 'Bottom of split squat. Hold heaviest available DB. Maximum effort throughout. Patellar tendon HSR — brief maximal holds at ≥90% MVC drive greater tendon stiffness than longer submaximal holds. Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '1', '8-10s each leg', '90s', 'Single-leg tiptoe hold. Hold heavy DB at side. Maximum effort. Achilles tendon HSR — brief ≥90% MVC holds maximise Achilles stiffness adaptation. Achilles health driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Stiff ankles. Minimum ground contact time. Elastic tendon return — train the spring at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  none: [
    ex('Isometric Split Squat Hold (Bodyweight)', '1', '10-12s each leg', '90s', 'Bottom of split squat, rear knee 2cm from floor, bodyweight. Maximum effort throughout — every second should feel hard. Brief maximal holds at ≥90% MVC drive patellar tendon stiffness. Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '1', '8-10s each leg', '90s', 'Rise onto single-leg tiptoe. Hold maximum effort. Achilles HSR — brief ≥90% MVC holds maximise stiffness adaptation. Tendon absorbs sprint load. Achilles health driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Ankles stiff. Minimum ground contact. Elastic SSC tendon return at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
};

// 1 isometric per session — the single highest-priority tendon stiffness driver.
// Patellar tendon isometric (split squat hold or wall sit) is chosen every session.
// Calf isometric removed to keep total volume low.

// Alternate patellar-tendon isometric when Bulgarian Split Squat is already in the session.
// Avoids back-to-back split squat pattern in the same session.
const WALL_SIT_ISO: Record<GymKey, ProgrammeExercise> = {
  full: ex(
    'Single-Leg Isometric Wall Sit (Heavy)',
    '1', '10-12s each leg', '90s',
    'Single-leg wall sit at 90° knee angle. Hold heaviest available DB on thigh. Maximum effort throughout — zero relaxing. Patellar tendon HSR without the split squat pattern (BSS already in session). Tendon stiffness driver.',
    { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' },
  ),
  basic: ex(
    'Single-Leg Isometric Wall Sit (DB)',
    '1', '10-12s each leg', '90s',
    'Single-leg wall sit at 90° knee. Hold heaviest available DB on thigh. Maximum effort. Patellar tendon HSR — substituted for split squat hold since BSS is already in this session.',
    { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' },
  ),
  none: ex(
    'Single-Leg Isometric Wall Sit (Bodyweight)',
    '1', '10-12s each leg', '90s',
    'Single-leg wall sit at 90° knee. Bodyweight. Maximum effort every second. Patellar tendon HSR — substituted for split squat hold since BSS is already in this session.',
    { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' },
  ),
};

/**
 * Returns exactly 1 isometric — the highest-priority patellar tendon stiffness driver.
 * When hasBSS=true the session already has BSS so use the wall sit instead (avoids
 * back-to-back split squat pattern in the same session).
 */
function buildIsometricBlock(gymKey: GymKey, hasBSS = false): ProgrammeExercise[] {
  return [hasBSS ? WALL_SIT_ISO[gymKey] : TENDON_SSC_BLOCK[gymKey][0]];
}

// Fascicle length physiology: eccentric contractions lengthen the muscle under tension →
// individual sarcomeres are trained at a longer length → the muscle can handle a longer stretch
// before individual sarcomeres "pop" (the mechanism of strain injury at high-speed running).
// Nordic Curl = highest-evidence fascicle-length exercise. Always included, always last.
// Eccentric RDL = complements Nordics — adds posterior chain fascicle length at the hip hinge pattern.
// Copenhagen Plank = adductor eccentric + isometric. Most evidenced groin prevention in football.

const ECCENTRIC_BLOCK: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Nordic Hamstring Curl', '2', '2', '3:00', '4s controlled lowering — maximum effort, fight the fall with everything. 2 reps only: every rep must be truly maximal. Physiology: eccentric lengthening increases hamstring fascicle length. Longer fascicles = individual sarcomeres operate over a wider range before failure — the primary mechanism reducing hamstring tear risk at high-speed running. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '1', '15s each side', '90s', 'Top foot on bench, bottom leg free. Adductor eccentric — the best groin protection exercise in football. Build hold time by 3-5s each week.',
      { tempo: '0-15s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  basic: [
    ex('Nordic Hamstring Curl', '2', '2', '3:00', '4s controlled lowering. Maximum effort — fight the fall with everything. 2 reps only: each rep fully maximal. Partner anchors feet or secure under heavy furniture. Fascicle length adaptation: longer sarcomere operating range = reduced strain risk at max sprint. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '1', '25s each side', '90s', 'Top foot on bench, hips free. Adductor eccentric + isometric. Groin strain prevention — highest evidence in football. Add 5s per week.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  none: [
    ex('Nordic Hamstring Curl', '2', '2', '3:00', '4s controlled lowering. Maximum effort — fight the fall completely. 2 reps only: each rep truly maximal. Anchor feet under sofa/door or use a partner. Fascicle length adaptation: the primary mechanism reducing hamstring tear risk at high-speed running. Non-negotiable every session.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '1', '25s each side', '90s', 'Top foot on chair/bench, hips free. Adductor eccentric. Groin prevention. Build 5s per week.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
};

// Core block — always last block in every gym session.
// Two exercises: one rotational (Rotational Cable Chop), one anti-rotation (Pallof Press).
// Rotation + anti-rotation covers the primary trunk-stability demands of football:
// cutting, turning, striking (rotation) and sprinting, heading, shooting (anti-rotation bracing).
const CORE_BLOCK: ProgrammeExercise[] = [
  ex('Rotational Cable Chop', '2', '10 each side', '60s',
    'Set cable to high position. Stand side-on to the stack, feet shoulder-width. Pull the handle diagonally downward across your body — from shoulder height to opposite hip. Drive the rotation from your core, not your arms. Control the return. Anti-rotation → rotational power: trains the obliques and deep core through the same diagonal force pattern used in shooting, crossing, and direction changes. Each side independently.',
    { tempo: '1-0-x-1', methodType: 'concentric', intensityIntent: 'controlled' }),
  ex('Pallof Press', '2', '10 each side', '60s',
    'Cable or resistance band at chest height. Press hands straight out and resist rotation completely. Anti-rotation: trains obliques and deep core to stiffen the trunk against lateral forces of cutting, turning, and striking. Face perpendicular to anchor. Step out to increase band tension.',
    { tempo: '1-1-1-1', methodType: 'isometric', intensityIntent: 'controlled' }),
];

// full: barbell + cable + machines available
// basic: barbells + dumbbells only (no cables, machines, or sled)
// none: bodyweight only (push-ups, inverted rows, pike push-ups)

const UPPER: Record<string, Record<GymKey, ProgrammeExercise[]>> = {
  Foundation: {
    full: [
      ex('Bench Press', '2', '5', '3:00', 'Horizontal push — the primary upper compound. Retract shoulder blades, explosive drive. 2 RIR. Add load each week as the bar keeps moving fast.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '4', '3:00', 'Dead hang start. Drive elbows down hard. Chin over bar. Add 5–10kg. 2 RIR — add weight as you progress.',
        { intensity: 'Add 5–10kg', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '5', '3:00', 'Horizontal push — the primary upper compound. Explosive drive, bar moves fast. 2 RIR. Add load each week.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '4', '3:00', 'Dead hang start. Drive elbows down hard. Chin over bar. Add weight via belt or backpack. 2 RIR.',
        { intensity: 'Add 5–10kg', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Push-Up (Max Effort)', '2', '6', '2:00', 'Hands just outside shoulders. Lower chest within 3cm of floor. Drive up explosively — leave the floor if possible. 2 RIR. Progress reps or elevate feet each week.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Table or Low Bar)', '2', '6', '2:00', 'Pull chest hard to bar. Heels on floor, body straight. Maximum effort — add a backpack or elevate feet as you progress.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  Build: {
    full: [
      ex('Bench Press', '2', '5', '3:00', 'Explosive push. 2 RIR. Bar speed is your autoregulation — rack when velocity drops. Heavy horizontal push.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '4', '3:00', 'Dead hang start. Drive elbows down hard. Chin over bar. Add 5–10kg. 2 RIR.',
        { intensity: 'Add 5–10kg', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '2', '4', '2:30', 'Dip and drive hips explosively. Aggressive lockout. Bar over heels. Maximum rate of force development.',
        { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '5', '3:00', 'Explosive push. 2 RIR. Bar moves fast. Barbell allows heavier load — use it.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '4', '3:00', 'Dead hang start. Drive elbows down hard. Chin over bar. Add weight via belt or backpack. 2 RIR.',
        { intensity: 'Add 5–10kg', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '2', '5', '2:30', 'Dip and drive hips. Explosive lockout overhead. DBs allow each arm to work independently.',
        { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Plyometric Push-Up', '2', '6', '2:30', 'Explosive push — hands leave the floor. Land softly. Maximum upper body power expression. Every rep full intent.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Table or Low Bar)', '2', '6', '2:00', 'Pull chest hard to bar, heels on floor. Max effort — elevate feet if 6 reps is not near failure.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up', '2', '6', '2:00', 'Hips high. Lower head toward floor. Drive up hard. Vertical push at max effort.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  'Strength & Power': {
    full: [
      ex('Bench Press', '2', '3', '3:30', 'Maximum force intent. Bar moves with authority every rep. 1–2 RIR. Heavy horizontal push.',
        { intensity: '84% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '3', '3:00', 'Drive elbows down hard. Explosive concentric. 1–2 RIR. Add enough weight to make 3 reps a real effort.',
        { intensity: 'Challenging', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '2', '4', '2:30', 'Dip and drive hips aggressively. Lockout at full extension. Maximum rate of force development.',
        { intensity: '78% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '4', '3:30', 'Maximum force intent. Bar moves fast on every rep. 1–2 RIR.',
        { intensity: '83% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '2', '3', '3:00', 'Drive elbows down hard. Explosive concentric. 1–2 RIR. Add enough weight to make 3 reps a real effort.',
        { intensity: 'Challenging', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '2', '4', '2:30', 'Dip and drive hips. Explosive lockout. Maximum rate of force development.',
        { intensity: 'Heavy DB', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Archer Push-Up', '2', '5 each side', '3:00', 'Wide hands. Lower to one side — that arm takes full load. Alternate sides. Maximum effort, unilateral bodyweight strength.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Feet Elevated)', '2', '6', '2:30', 'Feet elevated, pull chest to bar. Maximum effort — close to failure. Maximal bodyweight horizontal pull.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up (Deficit)', '2', '6', '2:00', 'Hands on elevated surface. Increase depth below hand level. Drive hard on every rep. Max effort vertical push.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  Peak: {
    full: [
      ex('Bench Press', '3', '2', '4:00', 'Peak expression. Maximum intent. Full rest between sets.',
        { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '3', '3', '4:00', 'Explosive concentric. Full recovery. Express peak upper strength.',
        { intensity: 'Heavy', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '3', '2:30', 'Explosive dip and drive. Express upper body rate of force development at peak intensity.',
        { intensity: '80% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '3', '4:00', 'Max intent. Full recovery. Express peak upper strength.',
        { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '3', '3', '4:00', 'Explosive concentric. Full recovery. Express peak upper strength.',
        { intensity: 'Heavy', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Explosive Push-Up', '2', '5 @ 1 RIR', '3:00', 'Maximum explosive intent on every rep. 1 RIR. Peak bodyweight upper expression.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Feet Elevated)', '2', '6 @ 1 RIR', '3:00', 'Peak bodyweight horizontal pull. 1 RIR. Full rest between sets.',
        { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
};

// Mirrors UPPER but replaces pull-up / weighted pull-up slots with row variants.
// Foundation.full and all .none entries are unchanged (DB Row / Inverted Row).

const UPPER_ROW: Record<string, Record<GymKey, ProgrammeExercise[]>> = {
  Foundation: {
    full: [
      ex('Bench Press', '2', '5', '3:00', 'Horizontal push — the primary upper compound. Retract shoulder blades, explosive drive. 2 RIR. Add load each week as the bar keeps moving fast.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '5', '2:30', 'Hinge to 45°. Pull the bar hard to your lower ribs, squeeze the lats. 2 RIR. Add load each week.',
        { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '5', '3:00', 'Horizontal push — the primary upper compound. Explosive drive, bar moves fast. 2 RIR. Add load each week.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '5', '2:30', 'Hinge to 45°. Pull the bar hard to your lower ribs, squeeze the lats. 2 RIR. Add load each week.',
        { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Push-Up (Max Effort)', '2', '6', '2:00', 'Hands just outside shoulders. Lower chest within 3cm of floor. Drive up explosively — leave the floor if possible. 2 RIR. Progress reps or elevate feet each week.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Table or Low Bar)', '2', '6', '2:00', 'Pull chest hard to bar. Heels on floor, body straight. Maximum effort — add a backpack or elevate feet as you progress.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  Build: {
    full: [
      ex('Bench Press', '2', '5', '3:00', 'Explosive push. 2 RIR. Bar speed is your autoregulation — rack when velocity drops. Heavy horizontal push.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '5', '3:00', 'Hinge to 45°. Drive bar to lower chest. Squeeze lats hard at the top. 2 RIR — add weight every week.',
        { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '2', '4', '2:30', 'Dip and drive hips explosively. Aggressive lockout. Bar over heels. Maximum rate of force development.',
        { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '5', '3:00', 'Explosive push. 2 RIR. Bar moves fast. Barbell allows heavier load — use it.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '5', '3:00', 'Hinge to 45°. Drive bar to lower chest. Squeeze lats hard at the top. 2 RIR — add weight every week.',
        { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '2', '5', '2:30', 'Dip and drive hips. Explosive lockout overhead. DBs allow each arm to work independently.',
        { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Plyometric Push-Up', '2', '6', '2:30', 'Explosive push — hands leave the floor. Land softly. Maximum upper body power expression. Every rep full intent.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Table or Low Bar)', '2', '6', '2:00', 'Pull chest hard to bar, heels on floor. Max effort — elevate feet if 6 reps is not near failure.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up', '2', '6', '2:00', 'Hips high. Lower head toward floor. Drive up hard. Vertical push at max effort.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  'Strength & Power': {
    full: [
      ex('Bench Press', '2', '3', '3:30', 'Maximum force intent. Bar moves with authority every rep. 1–2 RIR. Heavy horizontal push.',
        { intensity: '84% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '4', '3:00', 'Hinge 45°. Drive bar hard to lower chest. 1–2 RIR. Heavy horizontal pull to match the bench.',
        { intensity: '84% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '2', '4', '2:30', 'Dip and drive hips aggressively. Lockout at full extension. Maximum rate of force development.',
        { intensity: '78% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '4', '3:30', 'Maximum force intent. Bar moves fast on every rep. 1–2 RIR.',
        { intensity: '83% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '2', '4', '3:00', 'Hinge 45°. Drive bar hard to lower chest. 1–2 RIR. Add enough weight to make 4 reps a real effort.',
        { intensity: '83% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '2', '4', '2:30', 'Dip and drive hips. Explosive lockout. Maximum rate of force development.',
        { intensity: 'Heavy DB', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Archer Push-Up', '2', '5 each side', '3:00', 'Wide hands. Lower to one side — that arm takes full load. Alternate sides. Maximum effort, unilateral bodyweight strength.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Feet Elevated)', '2', '6', '2:30', 'Feet elevated, pull chest to bar. Maximum effort — close to failure. Maximal bodyweight horizontal pull.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up (Deficit)', '2', '6', '2:00', 'Hands on elevated surface. Increase depth below hand level. Drive hard on every rep. Max effort vertical push.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  Peak: {
    full: [
      ex('Bench Press', '3', '2', '4:00', 'Peak expression. Maximum intent. Full rest between sets.',
        { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '3', '3', '4:00', 'Explosive concentric. Full recovery. Express peak horizontal pull strength.',
        { intensity: 'Heavy', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '3', '2:30', 'Explosive dip and drive. Express upper body rate of force development at peak intensity.',
        { intensity: '80% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '3', '4:00', 'Max intent. Full recovery. Express peak upper strength.',
        { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Row', '3', '3', '4:00', 'Explosive concentric. Full recovery. Express peak horizontal pull strength.',
        { intensity: 'Heavy', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Explosive Push-Up', '2', '5 @ 1 RIR', '3:00', 'Maximum explosive intent on every rep. 1 RIR. Peak bodyweight upper expression.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Feet Elevated)', '2', '6 @ 1 RIR', '3:00', 'Peak bodyweight horizontal pull. 1 RIR. Full rest between sets.',
        { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
};


// Play-style running exercises — 3 variants each, rotated weekly so sessions feel fresh.
// ALL marked isRunning: true so they are filtered OUT of the strength block and
// routed to the separate Speed Work session card on the home screen.
const PLAY_STYLE_RUNNING: Record<string, ProgrammeExercise[]> = {
  'box-to-box': [
    ex('Box-to-Box Sprint', '5', '5 × 68m', '3:00',
      'Full box-to-box distance (~68m). Sprint from the edge of one penalty area to the other at maximum effort. Walk back as full recovery. Every rep the same intent — this is the quality that wins games in the 85th minute.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Repeated Sprint Ability', '6', '6 × 30m', '30s walk',
      '30m sprint at 95% effort, walk back in 30s. Do NOT rest longer — the fatigue is the stimulus. RSA: the most box-to-box midfield quality. Rep 6 should still feel like rep 3.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('30-15 Intermittent Intervals', '3', '4 min blocks', '3:00',
      'Run at the fastest pace you can sustain for 4 minutes, 30s easy jog, 15s hard. Repeat 3 blocks. This is the highest-evidence aerobic power protocol for football — directly improves VO2max and match distance.',
      { methodType: 'mixed', intensityIntent: 'submaximal', isRunning: true }),
  ],
  'direct': [
    ex('Sprint + Controlled Decel + Sprint', '4', '4 × 20m + stop + 20m', '3:00',
      'Direct play demands. Sprint 20m, plant and decelerate completely, then sprint 20m back. Burst, brake, repeat. The deceleration is the training stimulus — most hamstring injuries occur here.',
      { methodType: 'eccentric', intensityIntent: 'maximal', isRunning: true }),
    ex('30m Acceleration Sprint + Hard Stop', '5', '5 × 30m', '2:30',
      'Accelerate to top speed over 30m then plant both feet into a hard stop. Full deceleration mechanics every rep. Loaded eccentric at the hamstring insertion — direct play resilience.',
      { methodType: 'eccentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Turn & Sprint', '4', '4 × 10m back-pedal + 30m sprint', '3:00',
      'Back-pedal 10m (maintain upright posture), plant, turn and sprint 30m at maximum effort. Simulates defensive recovery → direct forward transition. Full rest — max quality every rep.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
  ],
  'technical': [
    ex('Lateral Bound + Balance Hold', '3', '5 each', '2:00',
      'Multi-directional agility. Stable landing = technical foundation.',
      { methodType: 'reactive', intensityIntent: 'controlled' }),
  ],
  'physical': [
    ex('Isometric Split Squat Hold', '1', '30s each', '2:00',
      'Bottom position hold. Physical duel strength and joint integrity.',
      { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
  ],
  'press-heavy': [
    ex('Short Sprint + Recovery Jog Circuit', '5', '5 × 10m sprint / 20m jog', 'Continuous',
      'Sprint 10m at maximum effort, then jog 20m back as recovery. Continuous circuit — simulates press trigger and immediate recovery. Do NOT walk — the jog recovery is the point.',
      { methodType: 'mixed', intensityIntent: 'submaximal', isRunning: true }),
    ex('Press Trigger Intervals', '6', '6 × 15s on / 15s off', '2:00 between rounds',
      '15s all-out sprint, 15s complete rest. 6 reps = 1 round. 3 rounds total. This matches the actual press trigger work-rest in a high-press system. Trains the short-burst repeated sprint capacity that fuels pressing.',
      { methodType: 'mixed', intensityIntent: 'maximal', isRunning: true }),
    ex('High-Press Interval Run', '3', '3 × 5 min blocks', '2:30',
      'Continuous effort at 80–85% max HR for 5 minutes. Represent the sustained aerobic demand of 90-minute high-press play. Stay above 78% HR the whole block — if HR drops too low, increase pace.',
      { methodType: 'mixed', intensityIntent: 'submaximal', isRunning: true }),
  ],
  'counter-attack': [
    ex('Acceleration from Set Position', '5', '5 × 30m', '3:00',
      'From standing or jogging — explosive transition to sprint. Do NOT pre-wind up. React instantly and hit top speed in the shortest distance possible. Counter-attack simulation: every metre of hesitation is a chance lost.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('Flying 30m Sprint', '4', '4 × 10m build + 30m fly', '4:00',
      'Build over 10m to 80%, then maximally accelerate through the 30m fly zone. Max velocity sprint — train the top-end speed you need to outrun defenders on the counter. Full 4 min rest: this is CNS, not conditioning.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Sprint + Cut + Sprint', '4', '4 × 15m + 45° cut + 20m', '3:00',
      'Sprint 15m, plant outside foot into a 45° cut, sprint 20m at full effort. Simulates receiving the ball on the counter and accelerating past the defender. Deceleration into the cut is the injury-prevention stimulus.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
  ],
};

// Lateral Bound — fill exercise for play styles requiring lateral CoD power
// Non-running play-style gym exercises (strength / isometric / plyometric)
const PLAY_STYLE_EX: Record<string, ProgrammeExercise[]> = {
  'box-to-box': [],
  'direct': [],
  'technical': PLAY_STYLE_RUNNING['technical'],
  'physical': PLAY_STYLE_RUNNING['physical'],
  'press-heavy': [],
  'counter-attack': [],
};


// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONING — week-based progressive overload (rebuilt from scratch).
// Three sections: Zone 2 (fixed), RSA (rep progression), HIIT (2 alternating
// workouts, each with its own rep progression). Progression is driven purely by
// weekNum — each conditioning type is scheduled at most once per week, so weekNum
// is also the appearance count for any type that runs every week.
// ─────────────────────────────────────────────────────────────────────────────

// HIIT Workout 1 — 18-yard shuttle. Three sub-sets of [1, 2, 4] reps in week 1.
// Each subsequent appearance adds ONE rep, round-robin across the three sub-sets:
//   1,2,4 → 2,2,4 → 2,3,4 → 2,3,5 → 3,3,5 → 3,4,5 → 3,4,6 …
function shuttleReps(appearance: number): [number, number, number] {
  const reps: [number, number, number] = [1, 2, 4];
  const increments = Math.max(0, appearance - 1);
  for (let i = 0; i < increments; i++) reps[i % 3]++;
  return reps;
}

// Builds the single HIIT main-work exercise for a given programme week.
// Odd weeks → Workout 1 (shuttle); even weeks → Workout 2 (4-min max effort).
// Each workout advances its own progression by how many times it has appeared.
function buildHiitWorkout(weekNum: number): { label: string; exercise: ProgrammeExercise } {
  const isShuttleWeek = weekNum % 2 === 1;

  if (isShuttleWeek) {
    const appearance = Math.ceil(weekNum / 2);       // shuttle runs wk 1,3,5… → 1st,2nd,3rd
    const [s1, s2, s3] = shuttleReps(appearance);
    return {
      label: '18-Yard Shuttle Acceleration',
      exercise: ex(
        '18-Yard Shuttle Acceleration',
        '3',
        `${s1} → ${s2} → ${s3} reps`,
        '60s between reps & sets',
        `THE PATTERN (1 rep): Start on the goal line. Recovery jog to the 18-yard line, then run at 80% to the far 18-yard line. From there recovery jog to the far goal line, turn, and recovery jog back to the 18-yard line — then run 80% across to the near 18-yard line. That completes one rep. For multiple reps in a set, recovery jog back to the goal line and start the next rep. ` +
        `THIS SESSION: 3 sets of ${s1}, then ${s2}, then ${s3} reps. 60 seconds rest between every rep and between every set. ` +
        `Progressive overload: one rep is added each session — week on week the shuttle volume climbs (${s1}/${s2}/${s3} this week). Hit every 80% run at a controlled, repeatable speed — this is acceleration quality under fatigue, not flat-out sprinting.`,
        { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true },
      ),
    };
  }

  const appearance = weekNum / 2;                     // 4-min run wk 2,4,6… → 1st,2nd,3rd
  const reps = 4 + (appearance - 1);
  return {
    label: '4-Minute Max Effort Run',
    exercise: ex(
      '4-Minute Max Effort Run',
      `${reps}`,
      '4 min max effort',
      '2:00 between',
      `${reps} efforts of 4 minutes at the hardest pace you can hold for the full 4 minutes — any route, flat ground. 2 minutes complete rest between efforts. ` +
      `Pace it so the last minute of every rep is a genuine grind but you never have to stop. Progressive overload: one extra 4-minute effort is added each time this workout comes round (${reps} efforts this week).`,
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true },
    ),
  };
}

/**
 * Selects the in-session conditioning exercise — guarantees TWO DIFFERENT TYPES each week.
 *
 * Strategy: split the week into two halves by day index.
 *   Half-0 (Mon–Wed, dayIdx 0–2) and Half-1 (Thu–Sun, dayIdx 3–6).
 *   After week 2, one half = aerobic, the other = HIIT.
 *   Week parity flips which half gets HIIT so types rotate each week.
 *
 * Progression model:
 *   Weeks 1–2  → 100% aerobic (injury prevention, connective tissue adaptation)
 *   Weeks 3+   → Half-week alternation: aerobic one day, HIIT another — both types every week
 *
 * Variant rotation: within each type, variants rotate using Math.floor(weekNum / 2)
 * so each variant gets ~2 weeks before cycling — prevents stagnation without repetition.
 */

const WEAKNESS_EX: Record<string, ProgrammeExercise[]> = {
  speed: [
    ex('Hip Flexor Sprint Drill', '3', '4 × 20m', '2:00', 'Rapid knee drive. Arms drive speed.',
      { methodType: 'concentric', intensityIntent: 'explosive', isRunning: true }),
    ex('Broad Jump', '3', '4', '2:00', 'Push horizontally off both feet. Load hips, drive arms. Land controlled — max distance every rep.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Single-Leg Hip Thrust (Glute Focus)', '2', '10 each', '90s', 'Shoulders on bench, non-working leg raised. Full hip extension. Squeeze at top. Glute/hamstring motor units — horizontal force without any equipment beyond a bench or low surface.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
  ],
  strength: [
    // Concentric strength work only — eccentrics belong in the Eccentric block.
    // Isometrics are handled by the dedicated 3-exercise Isometric Block every session.
    ex('Paused Squat (2s Bottom Hold)', '2', '5', '3:00', '2s pause at the bottom — maintain full tension throughout. Explosive drive up. Works with bodyweight or any load available. Supplemental only: 2 sets after the main compounds.',
      { tempo: '1-2-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Trap Bar Deadlift (Strength Focus)', '2', '4', '3:00', 'Hip-hinge strength builder. Explosive drive from the floor — hips and shoulders rise simultaneously. Supplemental force development after main compounds.',
      { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
  ],
  endurance: [
    ex('Aerobic Threshold Run', '1', '20 min', '', '70% max HR — truly conversational pace. Aerobic base.',
      { methodType: 'mixed', intensityIntent: 'moderate', isRunning: true }),
    ex('Cardiac Output Circuit', '3', '5 min', '90s rest', '1 min jog / 1 min bike / 1 min row / 1 min step-ups / 1 min air squat. HR 130–150.',
      { methodType: 'mixed', intensityIntent: 'moderate', isRunning: true }),
  ],
  power: [
    ex('Box Jump', '4', '5', '2:30', 'Step down (never jump down). Reset fully. Maximum upward intent.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Depth Jump', '3', '4', '3:00', 'Step off box. Minimise contact. Jump as high as possible.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
    ex('Bounding', '3', '6 reps', '2:00', 'Alternate-leg bounding. Drive the knee, push the ground back. Max horizontal distance per stride.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  injury_prone: [
    ex('Eccentric Step-Down (Single-Leg)', '3', '8 each', '90s', '4s controlled descent off a step — one leg only. Knee tracks over second toe throughout. Slow eccentric loads the quad and controls the knee, building the tissue resilience that reduces re-injury risk. Different pattern from the hip thrust and squat — covers the knee-dominant deceleration demand.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
};


const PREHAB: Record<string, ProgrammeExercise[]> = {
  hamstring: [
    ex('Nordic Hamstring Curl', '2', '2', '3:00', '4s eccentric — maximum effort, 2 reps only. Highest-evidence prevention. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Eccentric Single-Leg RDL', '2', '8 each', '90s', '4s lowering. Hold at bottom. Eccentric load is the protective stimulus.',
      { tempo: '4-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  ankle: [
    ex('Ankle Dorsiflexion Mob (Kneeling)', '3', '10 each', '30s', 'Kneeling lunge position. Drive knee forward over pinky toe — keep heel on floor. Rock forward and back. Restore full dorsiflexion range. No equipment needed.',
      { methodType: 'mixed', intensityIntent: 'controlled' }),
    ex('Single-Leg Calf Raise (Eccentric Emphasis)', '3', '12 each', '60s', 'Rise onto single-leg tiptoe (concentric), lower over 3s on the working leg (eccentric). Builds calf and Achilles resilience for ankle-injury-prone athletes.',
      { tempo: '1-0-3-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  knee: [
    ex('Isometric Wall Sit — Single-Leg at 60°', '1', '30s each', '2:00', '60° knee flexion against wall — single leg. Maximum effort. This is the clinically-validated patellar tendon HSR angle: heavy isometric at 60° directly increases patellar tendon stiffness. The tendon then absorbs more landing/deceleration load so the quad muscle doesn\'t overwork.',
      { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Eccentric Step-Down (4s Lower)', '3', '8 each', '90s', '4s single-leg descent. Knee tracks over second toe. Eccentric quad loading — increases fascicle length. Longer fascicles = individual sarcomeres tolerate more stretch before failure.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  groin: [
    ex('Copenhagen Plank — Eccentric Lower', '3', '6 each side', '2:00', 'Start with hips elevated, top foot on bench. Slowly lower hips over 4s — feel the adductor lengthen eccentrically under load. Return to top. Eccentric variant drives fascicle length adaptation in the adductor, reducing groin strain risk at full stride.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Adductor Squeeze (Resisted)', '2', '10', '60s', 'Lie on back, squeeze a ball or rolled towel between knees. Maximum adductor contraction for 2s per rep. Groin activation and motor control. No heavy equipment required.',
      { tempo: '1-2-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
  ],
  calf: [
    ex('Alfredson Eccentric Calf Protocol', '3', '15', '90s', 'Raise with both, lower on single leg over 3s. Knee straight for gastrocnemius, then repeat with knee bent for soleus. Eccentric loading increases fascicle length AND tendon capacity. If symptomatic (Achilles pain), perform 3×15 twice daily.',
      { tempo: '3-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Heavy Single-Leg Calf Isometric Hold', '1', '30s each', '90s', 'Rise onto single-leg tiptoe. Hold maximum effort — add weight via DB if possible. Achilles tendon HSR: heavy slow resistance increases tendon stiffness so the tendon (not the calf muscle) absorbs the sprint push-off load.',
      { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
  ],
  back: [
    ex('Bird Dog', '3', '8 each side', '60s', 'On all fours, extend opposite arm and leg simultaneously. Spine neutral — do not rotate the hips. Hold 2s at extension. Lumbar multifidus and glute activation for spinal stability under load.',
      { tempo: '1-2-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Glute Bridge Hold', '3', '10', '60s', 'Feet hip-width, drive hips to full extension. Hold 2s at the top — squeeze glutes. Lower with control. Posterior chain activation and lumbar stabilisation.',
      { tempo: '1-2-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
  ],
  shoulder: [
    ex('Side-Lying External Rotation', '3', '15 each', '60s', 'Lie on side. Elbow pinned at 90°. Rotate forearm upward slowly — 2s up, 2s down. Rotator cuff activation. No equipment needed.',
      { tempo: '2-0-2-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Prone T-Y-W (Scapular Control)', '3', '8 each shape', '60s', 'Lie face down. T: arms wide, thumbs up. Y: arms at 45°. W: elbows bent 90°, pull back. Squeeze shoulder blades on each. No equipment needed.',
      { methodType: 'concentric', intensityIntent: 'controlled' }),
  ],
};

// Note: Nordics and Copenhagen Plank are in ECCENTRIC_BLOCK (always last in session).
// DEFAULT_PREHAB: eccentric-only fallback for athletes with no injury history.
// The Isometric Block is always handled separately via buildIsometricBlock().

/**
 * Position-specific power block — 2 exercises added on heavy days only.
 * Exercises chosen to NOT overlap with EXPLOSIVE_PLYO_POOL, ECCENTRIC_BLOCK,
 * or the main strength compounds (vertical squat, hip thrust, upper push/pull).
 */
const POSITION_BLOCK: Record<string, { title: string; focus: string; exercises: ProgrammeExercise[] }> = {
  GK: {
    title: '🧤 Goalkeeper — Lateral Power',
    focus: 'Frontal-plane hip strength · dive mechanics · 2 sets only',
    exercises: [
      ex('Lateral Bound + Stick', '2', '5 each', '2:00',
        'Push explosively off one foot sideways. Stick the landing on the opposite foot for 1 full second. GK dive power — the push-off replicated in a controlled drill. Maximise lateral displacement. 2 sets only — keep CNS cost low.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },
  CB: {
    title: '🛡️ Centre-Back — Aerial Duel Power',
    focus: 'Single-leg vertical drive · aerial contest · 2 sets only',
    exercises: [
      ex('Explosive Step-Up', '2', '5 each', '2:30',
        'Drive hard off the box foot — leave the ground at the top. Alternate legs each set. Aerial duel power: the single-leg drive-off replicates the jump from a run. 2 sets only — quality over volume.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },
  FB: {
    title: '⚡ Full-Back — Closing Speed & Overlap',
    focus: 'Unilateral hip drive · overlap run mechanics · 2 sets only',
    exercises: [
      ex('Deficit Reverse Lunge (Explosive Drive)', '2', '5 each', '2:00',
        'Step back into a reverse lunge off a small step. Explosive drive to bring the back foot forward. Full-back hip flexor power — the forward drive into an overlapping run. 2 sets only.',
        { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
  },
  CM: {
    title: '⚙️ Central Midfield — Stride Power',
    focus: 'Unilateral hip extension · box-to-box stride mechanics · 2 sets only',
    exercises: [
      ex('Single-Leg Hip Thrust (Box)', '2', '10 each', '90s',
        'Shoulders on bench, one leg planted, other raised. Full single-leg hip extension. CM sprint mechanics: the hip extension force in each stride of a box-to-box run. 2 sets only.',
        { methodType: 'concentric', intensityIntent: 'moderate' }),
    ],
  },
  W: {
    title: '💨 Winger — Inside Cut Power',
    focus: 'Horizontal push-off force · inside cut mechanics · 2 sets only',
    exercises: [
      ex('Lateral Bound + Stick', '2', '6 each', '2:00',
        'Maximum lateral push off one foot. Stick landing on opposite foot for 1 second. Winger inside-cut mechanics — the frontal-plane force production that creates separation from defenders. 2 sets only.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },
  ST: {
    title: '🎯 Striker — First-Step Power',
    focus: 'Explosive hip extension from split stance · 2 sets only',
    exercises: [
      ex('Loaded Lunge (Explosive Drive)', '2', '5 each', '2:00',
        'DBs in hands. Step into a deep forward lunge. Explosive drive off the front foot back to standing. Striker first-step: hip extension from a split-leg base — the push-off from a standing start or off the turn. 2 sets only.',
        { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
  },
};

const DEFAULT_PREHAB: ProgrammeExercise[] = [
  ex('Eccentric Single-Leg Calf Raise', '2', '10 each', '60s', 'Rise on two legs, lower on one over 3s. Achilles and calf resilience — baseline eccentric maintenance for all footballers.',
    { tempo: '1-0-3-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
];


function applyReadiness(
  exs: ProgrammeExercise[],
  level: ReadinessLevel,
  intensityNote: string,
): ProgrammeExercise[] {
  if (level === 'elite') {
    // Add a bonus set to every exercise — athlete is firing on all cylinders.
    // Exception: Nordic variations are capped at 2 sets regardless of readiness.
    return exs.map(e => {
      const setsNum = Number(e.sets);
      const isNordic = e.name.toLowerCase().includes('nordic');
      const newSets = (!isNaN(setsNum) && !isNordic) ? String(setsNum + 1) : e.sets;
      return {
        ...e,
        sets: newSets,
        intensity: e.intensity ? `${e.intensity} (bonus set)` : 'Add 1 bonus set — elite readiness',
      };
    });
  }
  if (level === 'high') return exs;
  if (level === 'moderate') {
    return exs.map(e => ({
      ...e,
      intensity: e.intensity ? `${e.intensity} · ${intensityNote}` : intensityNote,
    }));
  }
  // low
  return exs.map(e => {
    const setsNum = parseInt(e.sets, 10);
    return {
      ...e,
      sets: (!isNaN(setsNum) && setsNum > 2) ? String(setsNum - 1) : e.sets,
      intensity: e.intensity ? `${e.intensity} · ${intensityNote}` : intensityNote,
    };
  });
}


function recoverySession(dow: string): ProgrammeSession {
  return {
    mdDay: 'MD+1',
    dayOfWeek: dow,
    objective: 'MD+1 — Active Recovery',
    readinessNote: 'MD+1 is always low load. No eccentric loading — fibres are recovering from match.',
    durationMin: 30,
    fvProfile: 'Recovery · isometrics + concentric cardio · zero eccentric load',
    blocks: [
      {
        title: '🚴 Concentric Cardio (15 min)',
        methodFocus: 'Concentric only · metabolite flush · HR < 120 bpm',
        exercises: [
          ex('Low-Intensity Cycling or Easy Walk', '1', '15 min at RPE 2–3', '', 'HR below 120 bpm. Legs should feel slightly better after this, not worse. Pedal with low resistance — this is a metabolite flush, not a workout.',
            { intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '🧘 Yielding Isometric Holds',
        methodFocus: 'Yielding isometrics · RPE 3–4 · analgesia not training',
        exercises: [
          ex('Single-Leg Glute Bridge Hold', '1', '30s each side', '60s', 'Shoulders on floor, hips extended, squeeze glute. RPE 3–4 — this is analgesia, not strength training. Breathe steadily. The goal is blood flow and pain reduction, not force production.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Wall Sit (Bilateral)', '1', '30s', '60s', 'Back flat against wall. Knees at 90°. RPE 3–4. Quadriceps isometric hold — reduces muscle soreness without adding eccentric damage. Breathe steadily throughout.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Prone Hamstring Isometric Hold', '1', '30s each side', '60s', 'Face down, ankle hooked under a fixed surface. Pull heel toward glute and hold. RPE 3–4. Hamstring isometric at mid-length — reduces DOMS without the eccentric loading that would add more micro-damage.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '🔄 Hip & Ankle Mobility',
        methodFocus: 'Restore ROM · gentle · non-fatiguing',
        exercises: [
          ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Breathe into end range. Never force it. Restore hip ROM lost from match day.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Supine Knee Hug', '1', '30s each side', '', 'Pull knee gently to chest. Hold at end range. Light and parasympathetic — restore hip flexor length lost from match day.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
    ],
  };
}


function primingSession(dow: string, position: string, _playStyle: string): ProgrammeSession {
  // Position-specific priming per HPP philosophy:
  // MD-1 is neurology, not muscle damage. Biomechanical execution matches primary match-day demands.
  // Protocol: 2 sets × 2–3 reps, bodyweight or very light load. Post-Activation Potentiation, zero metabolic cost.
  const positionPriming: Partial<Record<string, ProgrammeExercise[]>> = {
    CM: [
      ex('Lateral Pogo Jumps', '2', '5s (rapid)', '2:00', 'Ankles stiff, minimal ground contact. Rapid low-amplitude lateral hops. Multi-directional tendon stiffness — midfielders need fast elastic response in all planes. 5 seconds of continuous rapid hops, full CNS reset between sets.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Low-Amplitude Drop Jump', '2', '3 reps', '2:00', 'Step off a low box (15–20cm), land and immediately explode up. Minimal ground contact time. CNS priming only — not a conditioning exercise. Full 2-minute rest between sets.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    ST: [
      ex('Medicine Ball Broad Toss', '2', '3 reps', '2:00', 'Heavy medicine ball (4–6kg). Maximum horizontal displacement. Drive from the hips, not the arms. Horizontal Rate of Force Development — the same motor pattern as first-step acceleration. Full rest between reps.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Light Sled Push (10m)', '2', '10m', '2:30', 'Light load — you should be able to sprint the sled, not grind it. Low body angle. This is a neural primer, not a strength exercise. Maximum velocity on every push. Full rest.',
        { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    CB: [
      ex('Trap Bar Jump', '2', '3 reps', '2:00', '20% of 1RM trap bar deadlift load. Drive explosively from the floor — land softly. Vertical power and tendon stiffness for aerial duels. Maximum jump height every rep. Full reset between reps.',
        { intensity: '20% 1RM', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Vertical Countermovement Jump (CMJ)', '2', '3 reps', '2:00', 'Arms back, deep dip, drive through ceiling. Max height every rep. Stick landing 1 second. Post-Activation Potentiation — primes the same motor units used to win aerial duels tomorrow.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    GK: [
      ex('Explosive Lateral Bound + Stick', '2', '3 each way', '2:00', 'Push off outside foot explosively. Stick landing 1 second on inside foot. Simulates save-and-reset. PAP for reaction saves.',
        { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
    FB: [
      ex('Block Start Acceleration', '2', '10m', '2:00', 'From 3-point position. Maximum first-step intent. 10m only — this is a neural primer, not sprint conditioning. Full rest.',
        { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    W: [
      ex('Block Start Acceleration', '2', '10m', '2:00', 'Maximum intent from stationary. 10m sharp. Your primary weapon tomorrow is max velocity — wake up those fast-twitch units today.',
        { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
  };

  return {
    mdDay: 'MD-1',
    dayOfWeek: dow,
    objective: `MD-1 — Neural Priming`,
    readinessNote: 'MD-1 is always low load — CNS activation only. Leave feeling sharper, not tired.',
    durationMin: 25,
    fvProfile: 'Speed end · light load · max velocity · zero fatigue',
    blocks: [
      {
        title: '🔥 Movement Prep (8 min)',
        methodFocus: 'Mobility + CNS ramp · light and fast',
        exercises: [
          ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Restore hip ROM. Breathe into end range.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('A-Skip', '2', '20m', '30s', 'Crisp mechanics. Knee to hip height. Neural warm-up.',
            { intensityIntent: 'moderate' }),
          ex('Build-Up Sprint 50→70→85%', '2', '20m', '60s', 'Smooth ramp — feel the nervous system wake up. No flying start. Stop at 85%.',
            { intensityIntent: 'submaximal' }),
        ],
      },
      {
        title: '⚡ Position-Specific Neural Priming',
        methodFocus: 'PAP · match-day biomechanics · 2 sets · full CNS recovery',
        exercises: positionPriming[position] ?? [
          ex('Countermovement Jump', '2', '3 reps', '2:00', 'Max height. Stick landing 1s. Full rest between reps. Neural activation only.',
            { methodType: 'reactive', intensityIntent: 'explosive' }),
        ],
      },
      {
        title: '🛡️ Pre-Match Prehab',
        methodFocus: 'Sub-maximal prehab · protect soft tissue',
        exercises: [
          ex('Nordic Hamstring Curl (Sub-Max)', '1', '2 reps', '', '3s lowering — sub-maximal effort only. Tissue protection before match day, not a strength stimulus.',
            { tempo: '3-0-x-0', methodType: 'eccentric', intensityIntent: 'submaximal' }),
          ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Final hip ROM restoration before tomorrow\'s game.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
    ],
  };
}


const MUSCLE_INJURY_AREAS = ['hamstring', 'groin', 'calf', 'knee'] as const;

function hasMuscleInjury(injuryHistory: string[]): boolean {
  return injuryHistory.some(a => (MUSCLE_INJURY_AREAS as readonly string[]).includes(a));
}

function buildInjuryOrderedBlocks(
  muscleInjury: boolean,
  gymKey: GymKey,
  eccentricBlock: ProgrammeExercise[],
  isometricMethodFocus: string,
  eccentricMethodFocus: string,
  hasBSS = false,
): SessionBlock[] {
  const isoBlock: SessionBlock = {
    title: '🦴 Isometric Block',
    methodFocus: isometricMethodFocus,
    exercises: buildIsometricBlock(gymKey, hasBSS),
  };
  const eccBlock: SessionBlock = {
    title: '🔴 Eccentric Block',
    methodFocus: eccentricMethodFocus,
    exercises: [...eccentricBlock],
  };
  return muscleInjury ? [eccBlock, isoBlock] : [isoBlock, eccBlock];
}

// No match-day context. Load alternates Heavy/Moderate based on schedule spacing.
// Full 5-block structure every session. DOMS managed by session spacing alone.

function buildOffSeasonSession(
  slot: OsSlot,
  inputs: ProgrammeInputs,
  phase: string,
  weekNum: number,
  readiness: { level: ReadinessLevel; volumeMultiplier: number; intensityNote: string },
  emphasis?: TestEmphasis,
): ProgrammeSession {
  const { biggestWeakness, injuryHistory, gymAccess, position } = inputs;

  // Use heavy load on heavy days, moderate on moderate days
  const loadScheme = slot.load === 'heavy' ? 'heavy' : 'moderate';
  const gymLib = STRENGTH_LIBRARY[LIFT_PHASE];
  const gymAccessLib = gymLib[gymAccess as GymKey] ?? gymLib.basic;
  const strengthEx = gymAccessLib[loadScheme] ?? gymAccessLib.moderate;
  const upperBlock = inputs.upperPullChoice === 'row' ? UPPER_ROW : UPPER;
  const upperPhase = upperBlock[LIFT_PHASE];
  const upperEx = upperPhase[gymAccess as GymKey] ?? upperPhase.basic;

  const playStyleEx = PLAY_STYLE_EX[inputs.playStyle] ?? [];
  const weaknessEx = WEAKNESS_EX[biggestWeakness]?.slice(0, 2) ?? [];

  const prehabEx: ProgrammeExercise[] = [];
  for (const area of injuryHistory) {
    const p = PREHAB[area];
    if (p) prehabEx.push(p[weekNum % p.length]);
  }
  if (prehabEx.length === 0) prehabEx.push(...DEFAULT_PREHAB);

  const gymKey = (gymAccess as GymKey) in EXPLOSIVE_PLYO_POOL ? (gymAccess as GymKey) : 'basic';

  // Heavy days: full pogo volume (3×20). Moderate days: reduced (2×12).
  const pogoHops = pickReactivePlyo(gymKey, weekNum).map(e =>
    loadScheme === 'moderate'
      ? { ...e, sets: '2', reps: e.reps.includes('20') ? '12' : e.reps }
      : e,
  );

  // Heavy days: 3 sets × 3 reps explosive plyometrics. Moderate: same sets, 1 rep — neural quality without CNS fatigue accumulation.
  // CMJ grade emphasis boosts set count if player tests poorly on jump height.
  const explosivePlyo = boostExerciseSets(
    pickExplosivePlyo(gymKey, weekNum).map(e => loadScheme === 'moderate' ? { ...e, reps: '1' } : e),
    emphasis?.plyoSetBoost ?? 0,
  );

  // Upper body alternation: heavy days get both push + pull (upperEx[0] + upperEx[1]).
  // Moderate days rotate between push-only and pull-only each week — no back-to-back same stimulus.
  const upperExForSlot: ProgrammeExercise[] = loadScheme === 'moderate'
    ? [weekNum % 2 === 0 ? upperEx[0] : upperEx[1]].filter((e): e is ProgrammeExercise => e !== undefined)
    : upperEx;

  // Nordic is always 2×2 maximum — eccentric load is high and DOMS accumulates quickly.
  const eccentricBlock = ECCENTRIC_BLOCK[gymKey];

  const muscleInjury = hasMuscleInjury(injuryHistory);
  const osVertical = selectVerticalSquat(inputs, phase, gymKey, loadScheme, strengthEx);
  const osHasBSS = osVertical.name.toLowerCase().includes('bulgarian split squat');

  const loadLabel = slot.load === 'heavy' ? 'Heavy Day' : 'Moderate Day';
  const durationBase = slot.load === 'heavy' ? 70 : 60;
  const durationMin = readiness.level === 'low' ? durationBase - 15
    : readiness.level === 'elite' ? durationBase + 10
    : durationBase;

  // Gym sessions are pure strength/power — conditioning has its own dedicated sessions.
  // No aerobic bolt-on: the interference effect suppresses both strength and aerobic adaptation
  // when combined in the same session. Each quality gets its own day.

  const readinessNote =
    readiness.level === 'elite'
      ? 'Elite ✦ — Add a bonus set. Chase a PB. Conditions optimal.'
      : readiness.level === 'high'
      ? 'High ✓ — Execute as written. 2–1 RIR on main sets.'
      : readiness.level === 'moderate'
      ? 'Moderate — Drop ~10% load. RIR floor 2.'
      : 'Low — 1 fewer set, −20–25% load. Movement quality first.';

  return {
    mdDay: loadLabel,
    dayOfWeek: slot.dayOfWeek,
    objective: `Off Season — ${loadLabel} · Wk ${weekNum}`,
    readinessNote,
    durationMin,
    fvProfile: inputs.playStyle === 'press-heavy'
      ? slot.load === 'heavy'
        ? 'Press heavy day · explosive hip ext + lateral closing speed'
        : 'Press moderate day · aerobic run non-negotiable · controlled gym load'
      : slot.load === 'heavy'
      ? 'Off-season heavy · high load · low reps · no match ceiling'
      : 'Off-season moderate · controlled load · manage DOMS · quality first',
    blocks: [
      {
        title: '🔄 Mobilisation (6 min)',
        methodFocus: 'Hip + thoracic + glute activation · full joint prep',
        exercises: [...WARMUP_MOBILITY],
      },
      {
        title: '⚡ Explosive Plyometrics',
        methodFocus: (emphasis?.plyoSetBoost ?? 0) > 0
          ? `Max intent · CMJ grade boosted +${emphasis!.plyoSetBoost} set${emphasis!.plyoSetBoost > 1 ? 's' : ''} · 3 min rest`
          : loadScheme === 'heavy'
            ? 'Max intent · 3 reps · 3 min rest · no match ceiling'
            : 'Single max rep · 3 min rest · quality over volume',
        exercises: explosivePlyo,
      },
      (() => {
        const maxStrengthExercises = applyReadiness(
          buildMaxStrengthBlock(
            osVertical,
            strengthEx[1],
            upperExForSlot,
            loadScheme === 'heavy'
              ? [
                  ...(playStyleEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
                  ...(weaknessEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
                ]
              : [], // moderate days: no fill exercise — keeps total load lower
          ),
          readiness.level,
          readiness.intensityNote,
        );
        // Derive counts from actual exercises (slots 0,2,4 = lower; slots 1,3 = upper)
        const lowerCount = [0, 2, 4].filter(i => maxStrengthExercises[i] !== undefined).length;
        const upperCount = [1, 3].filter(i => maxStrengthExercises[i] !== undefined).length;
        const totalCount = maxStrengthExercises.length;
        const loadDesc = loadScheme === 'heavy' ? '85%+ load · explosive intent' : 'Controlled load · quality first';
        return {
          title: '💪 Maximum Strength',
          methodFocus: `${loadDesc} · ${totalCount} exercises · ${lowerCount} lower / ${upperCount} upper`,
          exercises: maxStrengthExercises,
        };
      })(),
      // Position-specific block: heavy days only — 2 targeted exercises per position
      ...(loadScheme === 'heavy' && POSITION_BLOCK[position] ? [{
        title: POSITION_BLOCK[position].title,
        methodFocus: POSITION_BLOCK[position].focus,
        exercises: POSITION_BLOCK[position].exercises,
      }] : []),
      {
        title: '🦘 Reactive Plyometrics',
        methodFocus: loadScheme === 'heavy'
          ? 'Stiff ankles · 20 reps · 90s rest · tendon spring'
          : 'Stiff ankles · 2×12 · tendon spring at lower volume',
        exercises: pogoHops,
      },
      ...buildInjuryOrderedBlocks(
        muscleInjury, gymKey, eccentricBlock,
        'Tendon HSR holds · patellar + Achilles stiffness',
        loadScheme === 'heavy'
          ? 'Fascicle length · DOMS peaks 48h · sessions spaced to manage'
          : 'Moderate · Nordic 2×2 · DOMS manageable at 48h spacing',
        osHasBSS,
      ),
      {
        title: '🧱 Core Block',
        methodFocus: 'Anti-extension + anti-rotation · deep trunk stability · last block',
        exercises: CORE_BLOCK,
      },
    ],
  };
}


/** Increase the `sets` string of every exercise in an array by `boost`. */
function boostExerciseSets(exercises: ProgrammeExercise[], boost: number): ProgrammeExercise[] {
  if (boost <= 0) return exercises;
  return exercises.map(e => {
    const base = parseInt(e.sets, 10);
    if (!Number.isFinite(base)) return e;
    return { ...e, sets: String(base + boost) };
  });
}

function buildSession(
  slot: MdSlot,
  inputs: ProgrammeInputs,
  phase: string,
  weekNum: number,
  readiness: { level: ReadinessLevel; volumeMultiplier: number; intensityNote: string },
  emphasis?: TestEmphasis,
): ProgrammeSession {
  if (slot.mdDay === 'MD+1') return recoverySession(slot.dayOfWeek);
  if (slot.mdDay === 'MD-1') return primingSession(slot.dayOfWeek, inputs.position, inputs.playStyle);

  const { position, biggestWeakness, injuryHistory, gymAccess } = inputs;
  const fv = getFVProfile(slot.mdDay);

  const gymLib = STRENGTH_LIBRARY[LIFT_PHASE];
  const gymAccessLib = gymLib[gymAccess] ?? gymLib.basic;
  const strengthEx = gymAccessLib[fv.loadScheme === 'heavy' ? 'heavy' : 'moderate'] ?? gymAccessLib.moderate;
  const upperBlock = inputs.upperPullChoice === 'row' ? UPPER_ROW : UPPER;
  const upperPhase = upperBlock[LIFT_PHASE];
  const upperEx = upperPhase[gymAccess as GymKey] ?? upperPhase.basic;

  const playStyleEx = PLAY_STYLE_EX[inputs.playStyle] ?? [];
  const weaknessEx = WEAKNESS_EX[biggestWeakness]?.slice(0, 2) ?? [];

  const prehabEx: ProgrammeExercise[] = [];
  for (const area of injuryHistory) {
    const p = PREHAB[area];
    if (p) prehabEx.push(p[weekNum % p.length]);
  }
  if (prehabEx.length === 0) prehabEx.push(...DEFAULT_PREHAB);

  const readinessNote =
    readiness.level === 'elite'
      ? 'Elite ✦ — Add a bonus set. Chase a PB. Conditions optimal.'
      : readiness.level === 'high'
      ? 'High ✓ — Execute as written. 2–1 RIR. Autoregulate by bar velocity.'
      : readiness.level === 'moderate'
      ? 'Moderate — Drop ~10% load. RIR floor 2. Rack if any rep grinds.'
      : 'Low — 1 fewer set, −20–25% load. Movement quality is today\'s goal.';

  const durationBase = slot.mdDay === 'MD-4' ? 70 : slot.mdDay === 'MD-3' ? 60 : 55;
  const durationMin = readiness.level === 'low' ? durationBase - 15
    : readiness.level === 'elite' ? durationBase + 10
    : durationBase;

  if (slot.mdDay === 'MD-4') {
    const gymKey = (gymAccess as GymKey) in EXPLOSIVE_PLYO_POOL ? (gymAccess as GymKey) : 'basic';
    const pogoHops = pickReactivePlyo(gymKey, weekNum);
    const muscleInjury = hasMuscleInjury(injuryHistory);
    const md4Vertical = selectVerticalSquat(inputs, phase, gymKey, fv.loadScheme as LoadKey, strengthEx);
    const md4HasBSS = md4Vertical.name.toLowerCase().includes('bulgarian split squat');

    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: 'MD-4 — Heavy Strength',
      readinessNote, durationMin,
      fvProfile: inputs.playStyle === 'press-heavy'
        ? 'Press system · explosive hip ext + lateral speed · aerobic base on moderate days'
        : fv.profile,
      blocks: [
        {
          title: '🔄 Mobilisation (6 min)',
          methodFocus: 'Hip + thoracic + glute activation · full joint prep',
          exercises: [...WARMUP_MOBILITY],
        },
        {
          title: '⚡ Explosive Plyometrics',
          methodFocus: emphasis?.plyoSetBoost
            ? `Max intent · CMJ grade: boosted +${emphasis.plyoSetBoost} set${emphasis.plyoSetBoost > 1 ? 's' : ''} · 3 min rest`
            : 'Max intent · 2–3 reps · 3 min rest · not conditioning',
          exercises: boostExerciseSets(pickExplosivePlyo(gymKey, weekNum), emphasis?.plyoSetBoost ?? 0),
        },
        (() => {
          const md4Fill = [
            ...(playStyleEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
            ...(weaknessEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
          ];
          const md4Exs = applyReadiness(
            buildMaxStrengthBlock(md4Vertical, strengthEx[1], upperEx, md4Fill),
            readiness.level, readiness.intensityNote,
          );
          const lowerCount = [0, 2, 4].filter(i => md4Exs[i] !== undefined).length;
          const upperCount = [1, 3].filter(i => md4Exs[i] !== undefined).length;
          const loadDesc = fv.loadScheme === 'heavy' ? '85%+ load · bar velocity autoregulates' : 'High load · explosive intent';
          return {
            title: '💪 Maximum Strength',
            methodFocus: `${loadDesc} · ${md4Exs.length} exercises · ${lowerCount} lower / ${upperCount} upper`,
            exercises: md4Exs,
          };
        })(),
        // Position-specific block on the heavy day (MD-4)
        ...(POSITION_BLOCK[position] ? [{
          title: POSITION_BLOCK[position].title,
          methodFocus: POSITION_BLOCK[position].focus,
          exercises: POSITION_BLOCK[position].exercises,
        }] : []),
        {
          title: '🦘 Reactive Plyometrics',
          methodFocus: 'Stiff ankles · min ground contact · tendon spring at match speed',
          exercises: pogoHops,
        },
        ...buildInjuryOrderedBlocks(
          muscleInjury, gymKey, ECCENTRIC_BLOCK[gymKey],
          'Heavy isometric holds · tendon stiffness adaptation',
          'Eccentric last · Nordic fascicle-length = primary hamstring protection',
          md4HasBSS,
        ),
        {
          title: '🧱 Core Block',
          methodFocus: 'Anti-extension + anti-rotation · deep trunk stability · last block',
          exercises: CORE_BLOCK,
        },
      ],
    };
  }

  if (slot.mdDay === 'MD-3') {
    const gymKey = (gymAccess as GymKey) in ECCENTRIC_BLOCK ? (gymAccess as GymKey) : 'basic';

    const structuralExercises: Record<GymKey, ProgrammeExercise[]> = {
      full: [
        ex('Eccentric Slider Curl (Nordic Variation)', '2', '2', '3:00', '4s eccentric lowering on the slider — maximum effort, fight the fall with everything. 2 reps only. Fascicle-length exercise: the slow eccentric under load lengthens the sarcomeres. DOMS peaks 48h, cleared by Saturday.',
          { intensity: '70–80% effort', tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
        ex('Single-Leg Romanian Deadlift', '3', '8 each', '2:00', 'Hinge to mid-shin with full control. Slow eccentric — 3s lowering. Hamstring fascicle length adaptation. Moderate load only: this is structural work, not a max strength stimulus. 70–80% 1RM.',
          { intensity: '70–80% 1RM', tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Bulgarian Split Squat (Structural)', '2', '8 each', '2:00', 'Rear foot elevated. 3s eccentric descent. Tissue architecture — quad and hip flexor fascicle adaptation. Moderate load. Drive hips through at the top.',
          { intensity: '70–80% 1RM', tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      basic: [
        ex('Barbell Romanian Deadlift (Eccentric Emphasis)', '3', '6', '2:30', '3–4s eccentric lowering to mid-shin. Barbell allows proper load — 70–80% 1RM. Hamstring fascicle-length adaptation. DOMS peaks 48h, gone by match day. This is why we do it today.',
          { intensity: '70–80% 1RM', tempo: '4-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Barbell Split Squat (Structural)', '3', '8 each', '2:00', 'Barbell on back, rear foot on bench. 3s eccentric descent. Quad and hip flexor fascicle length adaptation. Moderate load — 70–80% 1RM. Drive hips through at top.',
          { intensity: '70–80% 1RM', tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('DB Single-Leg Romanian Deadlift', '2', '8 each', '2:00', 'Hinge to mid-shin. 3s controlled descent. DB used for balance control on the single-leg pattern. Hamstring fascicle adaptation at hip hinge.',
          { intensity: 'Moderate DB', tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      none: [
        ex('Bodyweight Nordic Hamstring Curl (Eccentric Only)', '2', '2', '3:00', '4s eccentric lowering — maximum effort, fight the fall completely. 2 reps only: each rep truly maximal. Fascicle-length adaptation: sarcomeres lengthened under tension → wider operating range → reduced hamstring strain risk. DOMS peaks 48h, cleared by Saturday.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
        ex('Single-Leg RDL (Bodyweight)', '3', '8 each', '2:00', '3s eccentric lowering. Touch floor with fingertips. Hamstring fascicle length at the hip hinge. Add a backpack if too easy.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Slow Eccentric Split Squat', '2', '8 each', '90s', '3s eccentric descent. Full depth. Drive through front heel. Quad fascicle adaptation.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
    };

    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: 'MD-3 — Structural Loading',
      readinessNote: readinessNote + ' MD-3: DOMS peaks 48h — cleared by match day.',
      durationMin: 55, fvProfile: fv.profile,
      blocks: [
        {
          title: '🔄 Mobilisation (6 min)',
          methodFocus: 'Mobility + light activation · prep for eccentric load',
          exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 1)],
        },
        {
          title: '💪 Maximum Strength — Structural Loading',
          methodFocus: `70–80% 1RM · eccentric tempo · DOMS peaks 48h · gone by match day`,
          exercises: applyReadiness(structuralExercises[gymKey], readiness.level, readiness.intensityNote),
        },
        {
          title: '🦴 Isometric Block',
          methodFocus: 'Heavy isometric holds · maintain tendon stiffness · min dose',
          exercises: buildIsometricBlock(gymKey, true), // all MD-3 gym levels include a split squat structural exercise
        },
        {
          title: '🔴 Eccentric Block',
          methodFocus: 'Nordic + Copenhagen · fascicle length · highest structural stress · always last',
          exercises: ECCENTRIC_BLOCK[gymKey],
        },
        {
          title: '🧱 Core Block',
          methodFocus: 'Anti-extension + anti-rotation · deep trunk stability · last block',
          exercises: CORE_BLOCK,
        },
      ],
    };
  }

  if (slot.mdDay === 'MD-2') {
    const gymKey = (gymAccess as GymKey) in ECCENTRIC_BLOCK ? (gymAccess as GymKey) : 'basic';

    const microPowerEx: Record<GymKey, ProgrammeExercise[]> = {
      full: [
        ex('Jump Squat (30–40% 1RM)', '2', '3 reps', '3:00', 'Load bar at 30–40% of your squat 1RM. Drive explosively from the floor. Land softly. Maximum velocity intent on every rep. This is CNS maintenance — 2 sets, 3 reps, then walk away. Do NOT add volume.',
          { intensity: '30–40% 1RM', tempo: '1-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Hip Thrust (Speed Focus)', '2', '3 reps', '3:00', '30–40% of your hip thrust 1RM. Explosive drive — bar should move fast. Maximum velocity of movement. 2 sets only. Maintain CNS sharpness without leaving any fatigue.',
          { intensity: '30–40% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'explosive' }),
      ],
      basic: [
        ex('Explosive DB Goblet Squat Jump', '2', '3 reps', '3:00', 'Light DB (20–30% of normal goblet squat load). Explosive drive from the floor — leave the ground. Maximum intent on every rep. 2 sets, 3 reps only. Walk away.',
          { intensity: 'Light DB — max velocity', methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('DB Hip Thrust (Speed Focus)', '2', '3 reps', '3:00', 'Light DB on hips — 30–40% of normal. Drive hips through as explosively as possible. 2 sets, 3 reps. CNS maintenance only.',
          { intensity: '30–40% normal load', methodType: 'concentric', intensityIntent: 'explosive' }),
      ],
      none: [
        ex('Countermovement Jump', '2', '3 reps', '3:00', 'Bodyweight. Maximum height every rep. Full CNS reset between reps. 2 sets, 3 reps — then done. Micro-dosed CNS maintenance.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Broad Jump', '2', '3 reps', '3:00', 'Maximum horizontal displacement. Stick the landing. Full reset between reps. 2 sets only.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    };

    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: 'MD-2 — Micro-Power',
      readinessNote: 'MD-2: No heavy load regardless of readiness. Micro-power only then leave.',
      durationMin: 30, fvProfile: fv.profile,
      blocks: [
        {
          title: '🔄 Mobilisation (6 min)',
          methodFocus: 'Light activation · prep for micro-dosed power',
          exercises: [...WARMUP_MOBILITY.slice(0, 2), ...WARMUP_NEURAL.slice(0, 1)],
        },
        {
          title: '⚡ Explosive Plyometrics — Micro-Dosed (2 × 3 only)',
          methodFocus: 'Max velocity · 30–40% 1RM · CNS maintenance · 2×3 then leave',
          exercises: microPowerEx[gymKey],
        },
        {
          title: '🦴 Isometric — Pre-Match Tissue Maintenance',
          methodFocus: 'Sub-maximal isometric · maintain hip flexor + adductor · zero eccentric',
          exercises: [
            ex('Isometric Hip Flexor Hold (Kneeling)', '1', '30s each side', '', 'Tall kneeling, posterior pelvic tilt. Sub-maximal hold — maintain hip flexor length ahead of match day.',
              { methodType: 'isometric', intensityIntent: 'controlled' }),
            ex('Copenhagen Plank Hold', '1', '20s each side', '', 'Adductor maintenance — sub-maximal. 20 seconds only. Protect the groin for tomorrow. No eccentric loading.',
              { methodType: 'isometric', intensityIntent: 'controlled' }),
          ],
        },
      ],
    };
  }

  return primingSession(slot.dayOfWeek, position, inputs.playStyle);
}

// Each conditioning type is a standalone session — not bolted onto gym days.
// Separation principle: each physical quality gets its own day so neither
// strength nor aerobic adaptation is compromised by fatigue from the other.

function buildConditioningSession(
  type: 'zone2' | 'hiAerobic' | 'rsa',
  dayOfWeek: string,
  phase: string,
  weekNum: number,
  emphasis?: TestEmphasis,
): ProgrammeSession {
  void phase; // phase no longer drives conditioning — progression is week-based

  // Zone 2 — low-intensity aerobic, restorative, no fatigue cost. Fixed 20-min run.
  if (type === 'zone2') {
    const zoneEx = ex('Zone 2 Steady-State Run', '1', '20 min @ 65–70% HRmax', '—',
      'Conversational pace for the full 20 minutes — you should always be able to hold a complete sentence. This is deliberate cardiac training, not a hard run: 65–70% HRmax builds stroke volume, capillary density, and aerobic base with zero CNS cost. Fixed duration — keep it at 20 minutes every week. Use the talk test, no watch needed.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true });
    return {
      mdDay: 'Zone 2',
      dayOfWeek,
      objective: `Zone 2 — Aerobic Base · Wk ${weekNum}`,
      readinessNote: 'Zone 2 is restorative — always complete. Reduce duration if needed, never skip.',
      durationMin: 30,
      fvProfile: '65–70% HRmax · mitochondrial density · no CNS fatigue',
      blocks: [
        {
          title: '⚡ Sprint Activation',
          methodFocus: 'Max CNS activation before aerobic work · short, sharp, full recovery',
          exercises: [
            ex('Short Sprint Activation', '5', '10m', '60s',
              'The Mark: start with your heels on the goal line and sprint toward the penalty spot. The Math: the penalty spot is 12 yards (11m) from the goal line. The Sprint: accelerate from the goal line and decelerate just one stride before you step on the penalty spot. Maximum effort every rep — full 60s walk-back recovery between each. This is pure speed work, not conditioning.',
              { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
          ],
        },
        {
          title: '🌿 Zone 2 Aerobic',
          methodFocus: 'Steady-state cardiac output · conversational pace · 65–70% HRmax',
          exercises: [zoneEx],
        },
      ],
    };
  }

  // HIIT — two alternating workouts (odd weeks = 18-yard shuttle, even = 4-min max effort),
  // each carrying its own week-based rep progression.
  if (type === 'hiAerobic') {
    const { label, exercise: hiEx } = buildHiitWorkout(weekNum);
    return {
      mdDay: 'HIIT',
      dayOfWeek,
      objective: `HIIT — ${label} · Wk ${weekNum}`,
      readinessNote: 'Requires full effort. Low readiness: sub Zone 2 at 70% HR — valid choice.',
      durationMin: 50,
      fvProfile: 'Max-intensity intervals · VO₂max + repeated-effort tolerance · after gym day',
      blocks: [
        {
          title: '⚡ Sprint Activation',
          methodFocus: 'Max CNS activation before aerobic work · short, sharp, full recovery',
          exercises: [
            ex('Short Sprint Activation', '5', '10m', '60s',
              'The Mark: start with your heels on the goal line and sprint toward the penalty spot. The Math: the penalty spot is 12 yards (11m) from the goal line. The Sprint: accelerate from the goal line and decelerate just one stride before you step on the penalty spot. Maximum effort every rep — full 60s walk-back recovery between each. This is pure speed work, not conditioning. Finish feeling sharp, not tired.',
              { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
          ],
        },
        {
          title: '🔥 Aerobic Warm-Up',
          methodFocus: 'Progressive CV activation · 60% → 80% HRmax',
          exercises: [
            ex('Progressive Warm-Up Run', '1', '8 min build from 60% → 80% HRmax', '—',
              'Start at easy conversational pace. Increase effort every 2 minutes. Reach 80% HR by minute 7. Skipping this warm-up increases injury risk and reduces work quality in the intervals.',
              { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
          ],
        },
        {
          title: '🔥 High Intensity Intervals',
          methodFocus: 'Full quality every rep · incomplete recovery is the stimulus',
          exercises: [hiEx],
        },
        {
          title: '🌿 Cool-Down',
          methodFocus: 'Gradual cool-down · flush metabolites · reduce soreness',
          exercises: [
            ex('Cool-Down Jog', '1', '5 min @ 60% HRmax', '—',
              'Easy jog steadily reducing pace. HR should fall below 120bpm before stopping. Do not skip — this is part of the session.',
              { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
          ],
        },
      ],
    };
  }

  // RSA — repeated sprint ability. 30m flat-out sprints, 30s rest. Start at 6 reps,
  // add one rep every week. Fitness-test RSA grade can boost the starting volume.
  const rsaReps = 6 + (weekNum - 1) + (emphasis?.rsaIntervalBoost ?? 0);
  const rsaEx = ex('Repeated Sprints — 30m', '1', `${rsaReps} × 30m · 30s rest`, '—',
    `${rsaReps} flat-out 30m sprints with 30 seconds of passive recovery between each. Every rep must be a genuine maximal sprint — if your times drop off by more than ~10%, you have found your current ceiling. Progressive overload: one extra sprint is added every week (${rsaReps} this week). Walk back slowly inside the 30s rest.`,
    { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true });

  return {
    mdDay: 'RSA',
    dayOfWeek,
    objective: `RSA / Anaerobic · Wk ${weekNum}`,
    readinessNote: 'Highest CNS session. Low readiness: reduce sets, extend recovery to 35s.',
    durationMin: 45,
    fvProfile: 'Anaerobic · repeated sprint ability · neuromuscular fatigue resistance',
    blocks: [
      {
        title: '⚡ Sprint Warm-Up',
        methodFocus: 'Progressive speed build · prime neuromuscular system',
        exercises: [
          ex('Progressive Sprint Warm-Up', '1', '3 × 40m — 60%, 75%, 85% effort', '90s between',
            'Three building runs over 40m. First at 60% max speed, second at 75%, third at 85%. Never sprint flat-out in a warm-up. This activates the fast-twitch motor units that RSA training targets.',
            { methodType: 'concentric', intensityIntent: 'moderate', isRunning: true }),
        ],
      },
      {
        title: '⚡ Repeated Sprints',
        methodFocus: 'Max sprint quality every rep · incomplete recovery is the stimulus',
        exercises: [rsaEx],
      },
    ],
  };
}




function progressNote(week: number): string {
  const hint = 'Progress both load (compounds) and sprint distances in parallel.';
  if (week <= 2) return `Record every lift and sprint — baseline data drives all future progression. ${hint}`;
  if (week <= 5) return `Add 2.5–5kg to main compounds and extend sprint volumes vs last week. 3–2 RIR.`;
  if (week <= 9) return `Push toward technical limit — 2–1 RIR. ${hint}`;
  return 'Final phase: reduce sets by 1, increase intensity. Peak expression — maximise output.';
}

// Removes ALL conditioning/speed-work blocks from the main session and returns them
// as a standalone ProgrammeSession with its own neural warm-up on the same day.

function buildCoachExplanation(inputs: ProgrammeInputs, totalWeeks: number, readinessLevel: ReadinessLevel, emphasis?: TestEmphasis): string {
  const posLabels: Record<string, string> = {
    GK: 'goalkeeper', CB: 'centre back', FB: 'full back', CM: 'central midfielder', W: 'winger', ST: 'striker',
  };
  const goalLabels: Record<string, string> = {
    speed: 'speed and acceleration', strength: 'maximal strength', power: 'explosive power',
    endurance: 'endurance capacity', injury_prevention: 'injury prevention',
  };
  const pos = posLabels[inputs.position] ?? inputs.position;
  const goal = goalLabels[inputs.primaryGoal] ?? inputs.primaryGoal;
  const weaknessLine = inputs.biggestWeakness === 'injury_prone'
    ? 'Additional injury prevention work is embedded in every session — prehab is treated as non-negotiable, not optional.'
    : `Your identified weakness — ${inputs.biggestWeakness} — receives prioritised attention in dedicated blocks every session.`;
  const readinessLine = readinessLevel === 'elite' || readinessLevel === 'high'
    ? 'Your readiness score is high, so the programme is written at full intensity — take advantage of it.'
    : readinessLevel === 'moderate'
    ? 'Your readiness is moderate — loads are slightly adjusted, but every session remains productive.'
    : 'Your readiness is currently low. Intensity is reduced but no sessions are cut. Consistency through this period builds long-term resilience.';
  const styleNote = inputs.playStyle
    ? ` Your ${inputs.playStyle.replace(/-/g, '-')} play style is reflected in position-specific speed patterns and conditioning protocols.`
    : '';
  const doubleGameWeekNote = inputs.secondMatchDay
    ? `\n\nDouble game week — Survival Mode: your schedule includes a second match day (${capitalize(inputs.secondMatchDay)}). When two matches fall within 4 days, the HPP rule is simple: you cannot build fitness, you can only mitigate fatigue. MD-4 and MD-3 strength blocks are completely deleted from the algorithm in double-game weeks. MD+1 becomes recovery only (isometrics + bike). MD-1 becomes neural priming only — zero heavy lifting. The pitch is the only priority. Sleep, nutrition and soft-tissue work take precedence over prescribed sets.`
    : '';

  const testGradeSection = emphasis?.coachNotes.length
    ? `\n\n📊 Fitness Test Adjustments\n${emphasis.coachNotes.map(n => `• ${n}`).join('\n')}`
    : '';

  if (inputs.offSeason) {
    const condNote = inputs.conditioningTypes && inputs.conditioningTypes.length > 0
      ? ` Includes ${inputs.conditioningTypes.length} dedicated conditioning day${inputs.conditioningTypes.length > 1 ? 's' : ''} (${inputs.conditioningTypes.map(t => t === 'zone2' ? 'Zone 2' : t === 'hiit' ? 'Hi-Aerobic' : 'RSA').join(', ')}) — never combined with gym to avoid the interference effect.`
      : '';
    return `${totalWeeks}-week off-season programme for a ${pos} targeting ${goal}. ${weaknessLine}${styleNote}${condNote} Heavy Mon/Fri · Moderate Wed · 48h minimum between sessions. ${readinessLine}${testGradeSection}`;
  }

  return `${totalWeeks}-week programme for a ${pos} targeting ${goal}. ${weaknessLine}${styleNote} Sessions are structured around your match schedule — heaviest load furthest from match day, reducing as the game approaches.${doubleGameWeekNote} ${readinessLine}${testGradeSection}`;
}


export function generateProgramme(inputs: ProgrammeInputs): GeneratedProgramme {
  const { score, level: readinessLevel, guidance: readinessGuidance, volumeMultiplier, intensityNote } = calcReadiness(inputs.readiness);
  const totalWeeks = resolvedDuration(inputs);

  const POSITION_LABELS: Record<string, string> = {
    GK: 'Goalkeeper', CB: 'Centre Back', FB: 'Full Back', CM: 'Midfielder', W: 'Winger', ST: 'Striker',
  };
  const GOAL_LABELS: Record<string, string> = {
    speed: 'Speed & Acceleration', strength: 'Strength', power: 'Explosive Power',
    endurance: 'Endurance', injury_prevention: 'Injury Prevention',
  };

  const pos = POSITION_LABELS[inputs.position] ?? inputs.position;
  const goal = GOAL_LABELS[inputs.primaryGoal] ?? inputs.primaryGoal;

  const emphasis = buildTestEmphasis(inputs.testGrades);

  if (inputs.offSeason) {
    const gymCount = inputs.gymSessionsPerWeek ?? inputs.sessionsPerWeek ?? 3;
    // Merge user-selected conditioning types with any extra types driven by test grades
    const baseCondTypes = inputs.conditioningTypes ?? [];
    const mergedCondTypes = Array.from(new Set([
      ...baseCondTypes,
      ...emphasis.extraCondTypes.map(t => t === 'hiit' ? 'hiit' : t),
    ])) as ('zone2' | 'hiit' | 'rsa')[];
    const osSlots = mergedCondTypes.length > 0
      ? buildMixedOffSeasonSchedule(gymCount, mergedCondTypes)
      : (GYM_ONLY_SCHEDULES[gymCount] ?? GYM_ONLY_SCHEDULES[3]);

    const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
      const weekNum = i + 1;
      const { phase } = getPhase(weekNum, totalWeeks);
      const sessions = osSlots.flatMap(slot => {
        if (slot.sessionType === 'gym') {
          const session = buildOffSeasonSession(
            slot, inputs, phase, weekNum,
            { level: readinessLevel, volumeMultiplier, intensityNote },
            emphasis,
          );
          return [session];
        }
        return [buildConditioningSession(slot.sessionType, slot.dayOfWeek, phase, weekNum, emphasis)];
      });
      return {
        weekNumber: weekNum,
        phase: 'Progressive Block',
        phaseGoal: `Progressive overload — add load or reps vs last week. [Wk ${weekNum}: ${progressNote(weekNum)}]`,
        sessions,
      };
    });
    const finalWeeks = inputs.allowedDayIndices?.length
      ? remapSessionDays(weeks, inputs.allowedDayIndices)
      : weeks;
    return {
      id: `prog-${Date.now()}`,
      createdAt: Date.now(),
      title: `${pos} — ${goal} (Off Season)`,
      summary: `${totalWeeks}-week OFF-SEASON programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${osSlots.length} sessions/week · No match-day loading — DOMS managed by session spacing.`,
      coachExplanation: buildCoachExplanation(inputs, totalWeeks, readinessLevel, emphasis),
      readinessScore: score,
      readinessLevel,
      readinessGuidance,
      durationWeeks: totalWeeks,
      inputs,
      weeks: finalWeeks,
    };
  }

  const inSeasonGymCount = inputs.gymSessionsPerWeek ?? Math.min(inputs.sessionsPerWeek ?? 3, 3);
  const gymSlots = getMdSlots(inSeasonGymCount, inputs.matchDay, inputs.secondMatchDay);
  const baseCondTypes = inputs.conditioningTypes ?? [];
  // Merge test-grade-driven extra conditioning types — map 'hiit' correctly
  const inSeasonCondTypes = Array.from(new Set([
    ...baseCondTypes,
    ...emphasis.extraCondTypes.map(t => (t === 'hiit' ? 'hiit' : t) as 'zone2' | 'hiit' | 'rsa'),
  ]));
  const condSlotsForMatchDay = IN_SEASON_COND_SLOTS[inputs.matchDay] ?? IN_SEASON_COND_SLOTS.saturday;

  // Days already taken by the match(es) AND every gym session. Conditioning must avoid
  // ALL of these — not just match days — otherwise a conditioning session can stack on a
  // gym day (previously e.g. a Saturday-match athlete with 2 gym + HIIT got both the MD-2
  // gym and the Hi-Aerobic session on Thursday). 'midweek' has no literal day name, so map
  // it to its implied match day (Wednesday) to keep that day protected too.
  const PRIMARY_MATCH_DAY: Record<string, string> = {
    saturday: 'Saturday', sunday: 'Sunday', midweek: 'Wednesday',
  };
  const occupiedDays = new Set<string>([
    PRIMARY_MATCH_DAY[inputs.matchDay] ?? '',
    ...(inputs.secondMatchDay
      ? [capitalize(inputs.secondMatchDay)]
      : []),
    ...gymSlots.map(s => s.dayOfWeek),
  ]);

  // Place a conditioning session on its preferred day if free; otherwise shift to the
  // earliest free day in the week (earlier = further from a weekend match = safer for a
  // high-fatigue session). Returns null only if all 7 days are full (unreachable with
  // ≤2 gym + ≤2 matches + 3 conditioning).
  const placeCond = (preferred: MdSlot): MdSlot | null => {
    if (!occupiedDays.has(preferred.dayOfWeek)) {
      occupiedDays.add(preferred.dayOfWeek);
      return preferred;
    }
    for (const day of DAY_NAMES) {
      if (!occupiedDays.has(day)) {
        occupiedDays.add(day);
        return { ...preferred, dayOfWeek: day };
      }
    }
    return null;
  };

  // Build conditioning slots. Place the higher-fatigue types first (RSA, then Hi-Aerobic)
  // so they claim their match-protective preferred days before flexible Zone 2 fills in.
  const condSlots: { slot: MdSlot; sessionType: 'zone2' | 'hiAerobic' | 'rsa' }[] = [];
  if (inSeasonCondTypes.includes('rsa')) {
    const placed = placeCond(condSlotsForMatchDay.rsa);
    if (placed) condSlots.push({ slot: placed, sessionType: 'rsa' });
  }
  if (inSeasonCondTypes.includes('hiit')) {
    const placed = placeCond(condSlotsForMatchDay.hiAerobic);
    if (placed) condSlots.push({ slot: placed, sessionType: 'hiAerobic' });
  }
  if (inSeasonCondTypes.includes('zone2')) {
    const placed = placeCond(condSlotsForMatchDay.zone2);
    if (placed) condSlots.push({ slot: placed, sessionType: 'zone2' });
  }

  const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNum = i + 1;
    const { phase } = getPhase(weekNum, totalWeeks);

    const gymSessions = gymSlots.map(slot =>
      buildSession(slot, inputs, phase, weekNum, { level: readinessLevel, volumeMultiplier, intensityNote }, emphasis),
    );

    // Dedicated conditioning sessions
    const condSessions = condSlots.map(({ slot, sessionType }) =>
      buildConditioningSession(sessionType, slot.dayOfWeek, phase, weekNum, emphasis),
    );

    const sessions = [...gymSessions, ...condSessions]
      .sort((a, b) => {
        const ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        return (ORDER.indexOf(a.dayOfWeek ?? '') ?? 7) - (ORDER.indexOf(b.dayOfWeek ?? '') ?? 7);
      });

    return {
      weekNumber: weekNum,
      phase: 'Progressive Block',
      phaseGoal: `Progressive overload — add load or reps vs last week. [Wk ${weekNum}: ${progressNote(weekNum)}]`,
      sessions,
    };
  });

  const matchStr = capitalize(inputs.matchDay);
  const secondMatchStr = inputs.secondMatchDay
    ? ` + ${capitalize(inputs.secondMatchDay)}`
    : '';
  const condNote = condSlots.length > 0
    ? ` + ${condSlots.length} conditioning (${inSeasonCondTypes.join(', ')})`
    : '';

  const finalWeeks = inputs.allowedDayIndices?.length
    ? remapSessionDays(weeks, inputs.allowedDayIndices)
    : weeks;
  return {
    id: `prog-${Date.now()}`,
    createdAt: Date.now(),
    title: `${pos} — ${goal}`,
    summary: `${totalWeeks}-week personalised programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${inSeasonGymCount} gym sessions/week${condNote} · Match day: ${matchStr}${secondMatchStr}${inputs.secondMatchDay ? ' (double game weeks accounted for)' : ''}.`,
    coachExplanation: buildCoachExplanation(inputs, totalWeeks, readinessLevel, emphasis),
    readinessScore: score,
    readinessLevel,
    readinessGuidance,
    durationWeeks: totalWeeks,
    inputs,
    weeks: finalWeeks,
  };
}
