// Football Fitness Testing Battery

import { BaselineTest, BaselineResults, SingleTestResult, TestSession, TestType } from '../types';

// Grade 5 = Elite, 4 = Excellent, 3 = Good, 2 = Fair, 1 = Needs Improvement
// Normative data based on adult male field-sport athletes (electronic timing).
// Female thresholds apply proportional offsets consistent with published football literature.

type GradeKey = 5 | 4 | 3 | 2 | 1;

interface NormBand {
  male: number;   // threshold: score BETTER than this = that grade (for time: lower; for height/level: higher)
  female: number;
}

/**
 * 10m Sprint (s) — lower is better.
 * For gradeTime, each band stores the UPPER boundary (exclusive) of that level.
 * L5: < 1.60 | L4: 1.60–1.70 | L3: 1.71–1.80 | L2: 1.81–1.95 | L1: > 1.95
 */
const NORMS_10M: Record<GradeKey, NormBand> = {
  5: { male: 1.60,  female: 1.70 },
  4: { male: 1.71,  female: 1.81 },
  3: { male: 1.81,  female: 1.91 },
  2: { male: 1.96,  female: 2.06 },
  1: { male: 99,    female: 99   },
};

/**
 * 30m Sprint (s) — lower is better.
 * L5: < 3.90 | L4: 3.90–4.10 | L3: 4.11–4.30 | L2: 4.31–4.50 | L1: > 4.50
 */
const NORMS_30M: Record<GradeKey, NormBand> = {
  5: { male: 3.90,  female: 4.30 },
  4: { male: 4.11,  female: 4.51 },
  3: { male: 4.31,  female: 4.71 },
  2: { male: 4.51,  female: 4.91 },
  1: { male: 99,    female: 99   },
};

/**
 * CMJ height (cm) — higher is better.
 * L5: ≥ 60 | L4: 50–59 | L3: 40–49 | L2: 30–39 | L1: < 30
 */
const NORMS_CMJ: Record<GradeKey, NormBand> = {
  5: { male: 60, female: 48 },
  4: { male: 50, female: 38 },
  3: { male: 40, female: 28 },
  2: { male: 30, female: 20 },
  1: { male: 0,  female: 0  },
};

/**
 * RSA mean time (s) — lower is better (6 × 30m, 20 s passive rest).
 * L5: < 4.00 | L4: 4.00–4.10 | L3: 4.11–4.25 | L2: 4.26–4.45 | L1: > 4.45
 */
const NORMS_RSA_MEAN: Record<GradeKey, NormBand> = {
  5: { male: 4.00, female: 4.40 },
  4: { male: 4.11, female: 4.51 },
  3: { male: 4.26, female: 4.66 },
  2: { male: 4.46, female: 4.86 },
  1: { male: 99,   female: 99   },
};

/**
 * RSA Fatigue Index (%) — lower is better.
 * L5: < 3.0 | L4: 3.0–5.0 | L3: 5.1–7.0 | L2: 7.1–9.0 | L1: > 9.0
 */
const NORMS_FI: Record<GradeKey, NormBand> = {
  5: { male: 3.0,  female: 3.5 },
  4: { male: 5.1,  female: 5.6 },
  3: { male: 7.1,  female: 7.6 },
  2: { male: 9.1,  female: 9.6 },
  1: { male: 99,   female: 99  },
};

/**
 * Yo-Yo IR1 level — higher is better.
 * L5: > 20.2 | L4: 19.1–20.2 | L3: 18.1–18.8 | L2: 16.7–17.8 | L1: < 16.6
 */
const NORMS_YOYO: Record<GradeKey, NormBand> = {
  5: { male: 20.3, female: 17.0 },
  4: { male: 19.1, female: 15.5 },
  3: { male: 18.1, female: 13.0 },
  2: { male: 16.7, female: 10.5 },
  1: { male: 0,    female: 0    },
};

/**
 * Broad jump / standing long jump (cm) — higher is better.
 * Spec in metres; converted to cm for app storage.
 * L5: ≥ 280cm | L4: 250–279cm | L3: 230–249cm | L2: 200–229cm | L1: < 200cm
 */
const NORMS_BROAD_JUMP: Record<GradeKey, NormBand> = {
  5: { male: 280, female: 240 },
  4: { male: 250, female: 210 },
  3: { male: 230, female: 195 },
  2: { male: 200, female: 165 },
  1: { male: 0,   female: 0   },
};



/** Grade a time value (lower is better) */
function gradeTime(value: number, norms: Record<GradeKey, NormBand>, sex: 'male'|'female'): 1|2|3|4|5 {
  if (value < norms[5][sex]) return 5;
  if (value < norms[4][sex]) return 4;
  if (value < norms[3][sex]) return 3;
  if (value < norms[2][sex]) return 2;
  return 1;
}

/** Grade a magnitude value (higher is better) */
function gradeMag(value: number, norms: Record<GradeKey, NormBand>, sex: 'male'|'female'): 1|2|3|4|5 {
  if (value >= norms[5][sex]) return 5;
  if (value >= norms[4][sex]) return 4;
  if (value >= norms[3][sex]) return 3;
  if (value >= norms[2][sex]) return 2;
  return 1;
}

export const GRADE_LABELS: Record<1|2|3|4|5, string> = {
  5: 'Elite',
  4: 'Excellent',
  3: 'Good',
  2: 'Fair',
  1: 'Needs Work',
};

export const GRADE_COLOURS: Record<1|2|3|4|5, { bg: string; text: string; border: string }> = {
  5: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  4: { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
  3: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  2: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  1: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300'    },
};


/** FI (%) = [(Total sprint time − n × Best sprint time) / (n × Best sprint time)] × 100, where n = number of sprints */
export function calcFatigueIndex(sprintTimes: number[]): number | null {
  if (sprintTimes.length < 2) return null;
  const valid = sprintTimes.filter(t => t > 0);
  if (valid.length < 2) return null;
  const best  = Math.min(...valid);
  const total = valid.reduce((a, b) => a + b, 0);
  const n = valid.length;
  return ((total - n * best) / (n * best)) * 100;
}

export function calcBaselineResults(test: BaselineTest): BaselineResults {
  const sex = test.sex ?? 'male';
  const results: BaselineResults = {};

  // 10m sprint
  if (test.sprint10m) {
    results.sprint10mGrade = gradeTime(test.sprint10m, NORMS_10M, sex);
  }

  // 30m sprint
  if (test.sprint30m) {
    results.sprint30mGrade = gradeTime(test.sprint30m, NORMS_30M, sex);
  }

  // CMJ
  if (test.cmjBest) {
    results.cmjGrade = gradeMag(test.cmjBest, NORMS_CMJ, sex);
  }

  // Broad jump
  if (test.broadJumpBest) {
    results.broadJumpGrade = gradeMag(test.broadJumpBest, NORMS_BROAD_JUMP, sex);
  }

  // RSA
  if (test.rsaSprints && test.rsaSprints.length >= 2) {
    const valid = test.rsaSprints.filter(t => t > 0);
    results.rsaBestTime  = Math.min(...valid);
    results.rsaWorstTime = Math.max(...valid);
    results.rsaMeanTime  = valid.reduce((a, b) => a + b, 0) / valid.length;
    results.rsaGrade     = gradeTime(results.rsaMeanTime, NORMS_RSA_MEAN, sex);

    const fi = calcFatigueIndex(valid);
    if (fi !== null) {
      results.fatigueIndex = fi;
      results.fiGrade      = gradeTime(fi, NORMS_FI, sex);
    }
  }

  // Yo-Yo
  if (test.yoyoLevel) {
    results.yoyoGrade = gradeMag(test.yoyoLevel, NORMS_YOYO, sex);
  }

  // Anaerobic: driven by sprint speed and CMJ (reflect phosphocreatine + glycolytic)
  // Aerobic: driven by Yo-Yo and FI (high FI = poor aerobic contribution to RSA recovery)

  const anaScores: number[] = [];
  const aerScores: number[] = [];

  if (results.sprint30mGrade)    anaScores.push((results.sprint30mGrade    / 5) * 100);
  if (results.sprint10mGrade)    anaScores.push((results.sprint10mGrade    / 5) * 100);
  if (results.cmjGrade)          anaScores.push((results.cmjGrade          / 5) * 100);
  if (results.broadJumpGrade)    anaScores.push((results.broadJumpGrade    / 5) * 100);
  if (results.rsaGrade)          anaScores.push((results.rsaGrade          / 5) * 100);

  if (results.yoyoGrade) aerScores.push((results.yoyoGrade / 5) * 100);
  // FI: lower FI = better aerobic recovery → higher aerobic score
  if (results.fiGrade)   aerScores.push((results.fiGrade   / 5) * 100);
  // RSA mean also has an aerobic component
  if (results.rsaGrade)  aerScores.push((results.rsaGrade  / 5) * 100 * 0.5);

  if (anaScores.length) results.anaerobicScore = Math.round(anaScores.reduce((a,b)=>a+b,0) / anaScores.length);
  if (aerScores.length) results.aerobicScore   = Math.round(aerScores.reduce((a,b)=>a+b,0) / aerScores.length);

  return results;
}

export const POSITION_ENERGY_PROFILE: Record<string, {
  aerobic: number;
  anaerobic: number;
  sprintCount: string;
  keyDemand: string;
}> = {
  GK: {
    aerobic: 72, anaerobic: 28,
    sprintCount: '5–15 explosive bursts',
    keyDemand: 'Peak power, reaction speed, explosive jumps',
  },
  CB: {
    aerobic: 83, anaerobic: 17,
    sprintCount: '20–30 sprints',
    keyDemand: 'Aerial strength, acceleration, anaerobic power for duels',
  },
  FB: {
    aerobic: 86, anaerobic: 14,
    sprintCount: '30–40 sprints',
    keyDemand: 'Repeated sprint ability, high aerobic base, lateral speed',
  },
  CM: {
    aerobic: 90, anaerobic: 10,
    sprintCount: '25–35 sprints',
    keyDemand: 'Highest aerobic capacity in the team, repeated high-intensity runs',
  },
  W: {
    aerobic: 82, anaerobic: 18,
    sprintCount: '40–60 sprints',
    keyDemand: 'Most explosive sprints per game, top-end speed, anaerobic power',
  },
  ST: {
    aerobic: 80, anaerobic: 20,
    sprintCount: '20–30 sprints',
    keyDemand: 'Explosive anaerobic power for runs in behind, aerial ability',
  },
};


export const TEST_PROTOCOLS = {
  sprint10m: {
    name: '10m Sprint',
    whatItMeasures: 'First-step acceleration — the anaerobic phosphocreatine system.',
    setup: 'Mark a start line and a cone/marker exactly 10 metres ahead on flat, hard ground. Use a phone stopwatch or partner with a hand timer.',
    protocol: [
      'Stand behind the start line in a two-point staggered stance (one foot slightly forward).',
      'On your own signal, explode forward and sprint flat-out through the 10m cone.',
      'Stop the timer as you cross 10m.',
      'Rest 3 minutes. Take one attempt only (or two if you make a false start).',
    ],
  },
  sprint30m: {
    name: '30m Sprint',
    whatItMeasures: 'Maximum velocity and the transition from phosphocreatine to glycolytic energy.',
    setup: 'A 30m straight course, flat, on grass or a track. Cones at 0m, 10m, 30m.',
    protocol: [
      'Rest 5 minutes after the 10m sprint.',
      'Same start position. Sprint all-out through 30m.',
      'Your 10m split is automatically also your acceleration score.',
    ],
  },
  cmj: {
    name: 'Countermovement Jump (CMJ)',
    whatItMeasures: 'Lower-body explosive power and stretch-shortening cycle efficiency. Anaerobic power index.',
    setup: 'Stand next to a wall. Mark your standing reach height. Jump and mark the peak height. Measure the difference. Alternatively, use a jump-height app (My Jump 2, etc.).',
    protocol: [
      'Stand with feet shoulder-width, hands on hips (arms fixed removes upper-body contribution).',
      'Dip quickly to roughly a quarter-squat, then jump as high as possible.',
      'Land on both feet and stand still.',
      'Take 3 attempts with 45 seconds rest. Record the BEST height in centimetres.',
    ],
  },
  rsa: {
    name: 'Repeated Sprint Ability (RSA): 6 × 30m',
    whatItMeasures: 'Ability to maintain sprint speed across repeated efforts — reflects both anaerobic capacity and aerobic recovery.',
    setup: 'Flat 30m straight. Cones at start and finish. A partner operates this app and taps "Sprint Done" the instant you cross the finish line — this is essential for accurate timing.',
    protocol: [
      'PARTNER REQUIRED: Your partner holds the phone and taps "Sprint Done" the moment you cross the 30m line.',
      'Stand at the start line. The app counts down 5 seconds — sprint at full effort on "GO".',
      'Your partner taps "Sprint Done" exactly as you cross the finish. The app records the split time automatically.',
      'Rest 20 seconds passively (no jogging). Walk back to the start during rest.',
      'Repeat for all 6 sprints. Times are recorded automatically — no manual entry needed.',
    ],
    whyFI: 'The Fatigue Index shows how much your sprint speed drops from your fastest to your slowest rep. A low score means you stayed consistently quick across all 6 sprints. Elite footballers typically score below 3%.',
  },
  yoyo: {
    name: 'Yo-Yo Intermittent Recovery Test Level 1 (IR1)',
    whatItMeasures: 'Aerobic capacity specific to intermittent exercise — the strongest single predictor of total match distance covered in football. Measures maximal aerobic power (VO₂max proxy) under football-specific work-rest conditions.',
    setup: 'Two parallel lines exactly 20m apart, plus a third cone 5m behind the start line (recovery zone). Flat surface — grass or track. The app plays all beeps for you.',
    protocol: [
      'Set up cones: start line, far line 20m ahead, recovery cone 5m behind start.',
      'Press START in the app — a 5-second countdown beeps, then the test begins.',
      'On the GO beep: run 20m to the far cone. Arrive before the TURN beep.',
      'On the TURN beep: sprint back 20m to the start. The REST beep starts your 10-second recovery.',
      'Walk quickly to the recovery cone and back during the 10 seconds.',
      'Speed increases every few shuttles — listen for the 3-beep LEVEL-UP signal.',
      'Press STOP when you cannot reach the line in time. Your score is recorded automatically.',
      'Walk for 5–10 minutes after finishing — heart rate will be very high.',
    ],
  },
  broad_jump: {
    name: 'Standing Long Jump',
    whatItMeasures: 'Horizontal explosive power — reflects fast-twitch recruitment and rate of force development.',
    setup: 'A flat surface with a tape measure. Stand behind a line, feet shoulder-width apart.',
    protocol: [
      'Stand with toes behind the start line, feet shoulder-width apart.',
      'Bend knees and swing arms back, then explode forward, jumping as far as possible.',
      'Land with both feet. Measure from the start line to the back of the nearest heel.',
      'Take up to 3 attempts with 45 seconds rest. Record the BEST in centimetres.',
    ],
  },
};


export const TEST_LABELS: Record<TestType, string> = {
  '10m': '10m Sprint',
  '30m': '30m Sprint',
  cmj: 'Countermovement Jump',
  broad_jump: 'Standing Long Jump',
  rsa: 'Repeated Sprint Ability',
  yoyo: 'Yo-Yo IR1',
};

export const TEST_UNIT: Record<TestType, string> = {
  '10m': 's',
  '30m': 's',
  cmj: 'cm',
  broad_jump: 'cm',
  rsa: 's',   // mean time
  yoyo: 'level',
};

/** true = lower is better (time); false = higher is better (height/distance/level) */
export const TEST_LOWER_IS_BETTER: Record<TestType, boolean> = {
  '10m': true,
  '30m': true,
  cmj: false,
  broad_jump: false,
  rsa: true,
  yoyo: false,
};


export function calcTestSession(
  results: SingleTestResult[],
  sex: 'male' | 'female',
): {
  grades: Partial<Record<string, 1 | 2 | 3 | 4 | 5>>;
  aerobicScore?: number;
  anaerobicScore?: number;
} {
  const grades: Partial<Record<string, 1 | 2 | 3 | 4 | 5>> = {};
  const anaScores: number[] = [];
  const aerScores: number[] = [];

  for (const r of results) {
    if (r.skipped || r.best === 0) continue;
    switch (r.type) {
      case '10m': {
        const g = gradeTime(r.best, NORMS_10M, sex);
        grades['10m'] = g;
        anaScores.push((g / 5) * 100);
        break;
      }
      case '30m': {
        const g = gradeTime(r.best, NORMS_30M, sex);
        grades['30m'] = g;
        anaScores.push((g / 5) * 100);
        break;
      }
      case 'cmj': {
        const g = gradeMag(r.best, NORMS_CMJ, sex);
        grades['cmj'] = g;
        anaScores.push((g / 5) * 100);
        break;
      }
      case 'broad_jump': {
        const g = gradeMag(r.best, NORMS_BROAD_JUMP, sex);
        grades['broad_jump'] = g;
        anaScores.push((g / 5) * 100);
        break;
      }
      case 'rsa': {
        if (r.rsaMeanTime && r.rsaMeanTime > 0) {
          const g = gradeTime(r.rsaMeanTime, NORMS_RSA_MEAN, sex);
          grades['rsa'] = g;
          anaScores.push((g / 5) * 100 * 0.5);
          aerScores.push((g / 5) * 100 * 0.5);
        }
        if (r.fatigueIndex !== undefined && r.fatigueIndex >= 0) {
          const g = gradeTime(r.fatigueIndex, NORMS_FI, sex);
          grades['rsa_fi'] = g;
          aerScores.push((g / 5) * 100);
        }
        break;
      }
      case 'yoyo': {
        const g = gradeMag(r.best, NORMS_YOYO, sex);
        grades['yoyo'] = g;
        aerScores.push((g / 5) * 100);
        break;
      }
    }
  }

  return {
    grades,
    anaerobicScore: anaScores.length
      ? Math.round(anaScores.reduce((a, b) => a + b, 0) / anaScores.length)
      : undefined,
    aerobicScore: aerScores.length
      ? Math.round(aerScores.reduce((a, b) => a + b, 0) / aerScores.length)
      : undefined,
  };
}

/** Convert a new TestSession to the legacy BaselineTest format (backward compat). */
export function sessionToLegacyTest(session: TestSession): BaselineTest {
  const get = (type: TestType) => session.results.find(r => r.type === type && !r.skipped);
  const rsa = get('rsa');
  return {
    sprint10m: get('10m')?.best,
    sprint30m: get('30m')?.best,
    cmjBest: get('cmj')?.best,
    broadJumpBest: get('broad_jump')?.best,
    rsaSprints: rsa?.rsaAllSprints?.filter(t => t > 0),
    yoyoLevel: get('yoyo')?.best,
    sex: session.sex,
    completedAt: session.completedAt,
  };
}

/**
 * Cumulative distance (metres) at the START of each Yo-Yo IR1 level.
 * Each shuttle = 2 × 20m = 40m.
 * Level 5 starts at 0m (2 shuttles); all other levels have 4 shuttles each.
 */
const YOYO_LEVEL_START_M: Record<number, number> = {
   5:    0,  6:   80,  7:  240,  8:  400,  9:  560,
  10:  720, 11:  880, 12: 1040, 13: 1200, 14: 1360,
  15: 1520, 16: 1680, 17: 1840, 18: 2000, 19: 2160,
  20: 2320, 21: 2480, 22: 2640, 23: 2800,
};

/**
 * Convert a stored Yo-Yo IR1 level (e.g. 17.5 = level 17, shuttle 5) to
 * total metres covered.
 */
export function calcYoyoDistance(yoyoLevel: number): number {
  const level   = Math.floor(yoyoLevel);
  const shuttle = Math.round((yoyoLevel - level) * 10);
  const base    = YOYO_LEVEL_START_M[level] ?? 0;
  return base + shuttle * 40;
}

/** Estimate relative VO₂max (ml·kg⁻¹·min⁻¹) from Yo-Yo IR1 distance. Formula: VO₂max = 0.0084 × distance(m) + 36.4 */
export function calcVo2Max(yoyoLevel: number): number {
  return Math.round((0.0084 * calcYoyoDistance(yoyoLevel) + 36.4) * 10) / 10;
}

/** Compute delta and improvement for progression display. */
export function getProgression(
  current: number,
  previous: number,
  lowerIsBetter: boolean,
): { delta: number; pct: number; improved: boolean } {
  const delta = current - previous;
  const pct = previous !== 0 ? Math.abs((delta / previous) * 100) : 0;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return { delta, pct, improved };
}
