/**
 * Football Fitness Testing Battery
 *
 * Scientific basis & key references:
 *
 * REPEATED SPRINT ABILITY & FATIGUE INDEX
 *   Girard O, Mendez-Villanueva A, Bishop D (2011). Repeated-sprint ability — Part I:
 *   Factors contributing to fatigue. Sports Medicine, 41(8), 673–694.
 *   → Protocol: 6 × 30 m, 20 s passive rest. FI formula validated here.
 *
 *   Spencer M, Bishop D, Dawson B, Goodman C (2005). Physiological and metabolic
 *   responses of repeated-sprint activities. Sports Medicine, 35(12), 1025–1044.
 *   → RSA is specific to team-sport demands; FI reflects anaerobic maintenance.
 *
 *   Glaister M (2005). Multiple sprint work: Physiological responses, mechanisms of
 *   fatigue and the influence of aerobic fitness. Sports Medicine, 35(9), 757–777.
 *   → Higher aerobic capacity → lower fatigue index in RSA.
 *
 * YO-YO INTERMITTENT RECOVERY TEST
 *   Bangsbo J, Iaia FM, Krustrup P (2008). The Yo-Yo intermittent recovery test:
 *   A useful tool for evaluation of physical performance in intermittent sports.
 *   Sports Medicine, 38(1), 37–51.
 *   → Yo-Yo IR1 is the criterion measure for aerobic capacity in football.
 *
 * SPRINT TESTING
 *   Haugen TA, Tønnessen E, Seiler S (2012). Speed and countermovement-jump
 *   characteristics of elite female soccer players, 1995–2010. International Journal
 *   of Sports Physiology and Performance, 7(4), 340–349.
 *
 *   Cometti G, Maffiuletti NA, Pousson M, Chatard JC, Maffulli N (2001). Isokinetic
 *   strength and anaerobic power of elite, subelite and amateur French soccer players.
 *   International Journal of Sports Medicine, 22(1), 45–51.
 *
 * CMJ
 *   Linthorne NP (2001). Analysis of standing vertical jumps using a force platform.
 *   American Journal of Physics, 69(11), 1198–1204.
 *
 * ENERGY SYSTEMS IN FOOTBALL
 *   Stølen T, Chamari K, Castagna C, Wisløff U (2005). Physiology of soccer: An
 *   update. Sports Medicine, 35(6), 501–536.
 *   → ~88–90% of match energy is aerobic; explosive actions (sprints, jumps) are
 *     almost entirely anaerobic. Aerobic capacity governs recovery between sprints.
 *
 *   Rampinini E, Impellizzeri FM, Castagna C, et al. (2007). Factors associated with
 *   physical performance in professional soccer players. European Journal of Applied
 *   Physiology, 102(6), 655–663.
 *   → Yo-Yo IR1 and sprint performance are independent predictors of match running.
 */

import { BaselineTest, BaselineResults, SingleTestResult, TestSession, TestType } from '../types';

// ── Norm tables ────────────────────────────────────────────────────────────
// Grade 4 = excellent, 3 = good, 2 = average, 1 = below average

type GradeKey = 4 | 3 | 2 | 1;

interface NormBand {
  male: number;   // threshold: score BETTER than this = that grade (for time: lower; for height/level: higher)
  female: number;
}

/** 10m sprint (s) — lower is better */
const NORMS_10M: Record<GradeKey, NormBand> = {
  4: { male: 1.65,  female: 1.75 },  // excellent: faster than this
  3: { male: 1.75,  female: 1.85 },  // good
  2: { male: 1.85,  female: 1.95 },  // average
  1: { male: 99,    female: 99   },  // below average (catch-all)
};

/** 30m sprint (s) — lower is better */
const NORMS_30M: Record<GradeKey, NormBand> = {
  4: { male: 3.90,  female: 4.30 },
  3: { male: 4.10,  female: 4.50 },
  2: { male: 4.30,  female: 4.70 },
  1: { male: 99,    female: 99   },
};

/** CMJ height (cm) — higher is better */
const NORMS_CMJ: Record<GradeKey, NormBand> = {
  4: { male: 45, female: 35 },  // excellent: above this
  3: { male: 35, female: 27 },
  2: { male: 25, female: 20 },
  1: { male: 0,  female: 0  },
};

/** RSA mean time (s) — lower is better (30m × 6, 20 s rest) */
const NORMS_RSA_MEAN: Record<GradeKey, NormBand> = {
  4: { male: 4.10, female: 4.50 },
  3: { male: 4.25, female: 4.65 },
  2: { male: 4.45, female: 4.85 },
  1: { male: 99,   female: 99   },
};

/** Fatigue Index (%) — lower is better */
const NORMS_FI: Record<GradeKey, NormBand> = {
  4: { male: 3.0, female: 3.5 },  // excellent: below this
  3: { male: 5.0, female: 5.5 },
  2: { male: 8.0, female: 8.5 },
  1: { male: 99,  female: 99  },
};

/** Yo-Yo IR1 level — higher is better */
const NORMS_YOYO: Record<GradeKey, NormBand> = {
  4: { male: 20,  female: 17  },  // level 20+ = excellent
  3: { male: 17,  female: 14  },
  2: { male: 14,  female: 11  },
  1: { male: 0,   female: 0   },
};

/** Broad jump / standing long jump (cm) — higher is better */
const NORMS_BROAD_JUMP: Record<GradeKey, NormBand> = {
  4: { male: 250, female: 210 },
  3: { male: 220, female: 185 },
  2: { male: 190, female: 160 },
  1: { male: 0,   female: 0   },
};

/** RSA 6 × 20m mean time (s) — lower is better */
const NORMS_RSA_20M: Record<GradeKey, NormBand> = {
  4: { male: 2.80, female: 3.10 },
  3: { male: 2.95, female: 3.25 },
  2: { male: 3.15, female: 3.45 },
  1: { male: 99,   female: 99   },
};

// ── Grading helpers ────────────────────────────────────────────────────────

/** Grade a time value (lower is better) */
function gradeTime(value: number, norms: Record<GradeKey, NormBand>, sex: 'male'|'female'): 1|2|3|4 {
  if (value < norms[4][sex]) return 4;
  if (value < norms[3][sex]) return 3;
  if (value < norms[2][sex]) return 2;
  return 1;
}

/** Grade a magnitude value (higher is better) */
function gradeMag(value: number, norms: Record<GradeKey, NormBand>, sex: 'male'|'female'): 1|2|3|4 {
  if (value >= norms[4][sex]) return 4;
  if (value >= norms[3][sex]) return 3;
  if (value >= norms[2][sex]) return 2;
  return 1;
}

export const GRADE_LABELS: Record<1|2|3|4, string> = {
  4: 'Excellent',
  3: 'Good',
  2: 'Average',
  1: 'Below Average',
};

export const GRADE_COLOURS: Record<1|2|3|4, { bg: string; text: string; border: string }> = {
  4: { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
  3: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  2: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  1: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300'    },
};

// ── Core calculation ───────────────────────────────────────────────────────

/**
 * Fatigue Index (Girard et al., 2011)
 * FI (%) = [(Total sprint time − n × Best sprint time) / (n × Best sprint time)] × 100
 * Where n = number of sprints
 */
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

  // ── Energy system composite scores (0–100) ──────────────────────────────
  // Anaerobic: driven by sprint speed and CMJ (reflect phosphocreatine + glycolytic)
  // Aerobic: driven by Yo-Yo and FI (high FI = poor aerobic contribution to RSA recovery)

  const anaScores: number[] = [];
  const aerScores: number[] = [];

  if (results.sprint30mGrade) anaScores.push((results.sprint30mGrade / 4) * 100);
  if (results.sprint10mGrade) anaScores.push((results.sprint10mGrade / 4) * 100);
  if (results.cmjGrade)       anaScores.push((results.cmjGrade      / 4) * 100);
  if (results.rsaGrade)       anaScores.push((results.rsaGrade      / 4) * 100);

  if (results.yoyoGrade) aerScores.push((results.yoyoGrade / 4) * 100);
  // FI: lower FI = better aerobic recovery → higher aerobic score
  if (results.fiGrade)   aerScores.push((results.fiGrade   / 4) * 100);
  // RSA mean also has an aerobic component
  if (results.rsaGrade)  aerScores.push((results.rsaGrade  / 4) * 100 * 0.5);

  if (anaScores.length) results.anaerobicScore = Math.round(anaScores.reduce((a,b)=>a+b,0) / anaScores.length);
  if (aerScores.length) results.aerobicScore   = Math.round(aerScores.reduce((a,b)=>a+b,0) / aerScores.length);

  return results;
}

// ── Position energy system profiles ────────────────────────────────────────
// Based on Stølen et al. (2005) and position GPS data

export const POSITION_ENERGY_PROFILE: Record<string, {
  aerobic: number;    // % of match energy from aerobic system (Stølen 2005)
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

// ── Test protocol descriptions ─────────────────────────────────────────────

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
    reference: 'Cometti et al. (2001) Int J Sports Med',
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
    reference: 'Haugen et al. (2012) Int J Sports Physiol Perform',
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
    reference: 'Linthorne (2001) Am J Phys; Bosco et al.',
  },
  rsa: {
    name: 'Repeated Sprint Ability (RSA): 6 × 20m',
    whatItMeasures: 'Ability to maintain sprint speed across repeated efforts — reflects both anaerobic capacity and aerobic recovery.',
    setup: 'Flat 20m straight. Cones at start and finish. A partner operates this app and taps "Sprint Done" the instant you cross the finish line — this is essential for accurate timing.',
    protocol: [
      'PARTNER REQUIRED: Your partner holds the phone and taps "Sprint Done" the moment you cross the 20m line.',
      'Stand at the start line. The app counts down 5 seconds — sprint at full effort on "GO".',
      'Your partner taps "Sprint Done" exactly as you cross the finish. The app records the split time automatically.',
      'Rest 20 seconds passively (no jogging). Walk back to the start during rest.',
      'Repeat for all 6 sprints. Times are recorded automatically — no manual entry needed.',
    ],
    whyFI: 'The Fatigue Index (Girard et al., 2011) quantifies the % decrease in sprint performance over repeated efforts. Formula: FI = [(Total time − n × Best time) / (n × Best time)] × 100. A low FI means your aerobic system effectively resynthesises phosphocreatine between sprints. Elite footballers typically show FI < 3%.',
    reference: 'Girard et al. (2011) Sports Med; Spencer et al. (2005) Sports Med',
  },
  yoyo: {
    name: 'Yo-Yo Intermittent Recovery Test Level 1 (IR1)',
    whatItMeasures: 'Aerobic capacity specific to intermittent exercise — the strongest single predictor of total match distance covered in football (Bangsbo et al., 2008). Measures maximal aerobic power (VO₂max proxy) under football-specific work-rest conditions.',
    setup: 'Two parallel lines exactly 20m apart, plus a third line 5m behind the start (recovery zone). You need the official Yo-Yo IR1 beep audio file (free online). Flat surface, football boots or trainers.',
    protocol: [
      'Set up two cones 20m apart. Place a third cone 5m behind the start — this is your 10-second recovery zone.',
      'Start standing on the start line. Press play on the Yo-Yo IR1 audio track.',
      'On the first beep: run 20m to the far line. Reach it before the second beep.',
      'On the second beep: run back 20m to the start line. You have 10 seconds of active recovery in the 5m zone.',
      'The speed increases every 1–2 stages (each stage = 2–4 shuttles depending on level).',
      'Test ends when you fail to reach the line in time on TWO consecutive shuttles.',
      'Record the last COMPLETED level and shuttle number (e.g. Level 17, Shuttle 3 = enter "17.3").',
      'Walk for 5–10 minutes after — heart rate will be very high at max effort.',
    ],
    reference: 'Bangsbo et al. (2008) Sports Med',
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
    reference: 'Maulder & Cronin (2005) J Sports Sci',
  },
};

// ── Test display metadata ──────────────────────────────────────────────────

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

// ── New session-based calc ─────────────────────────────────────────────────

export function calcTestSession(
  results: SingleTestResult[],
  sex: 'male' | 'female',
): {
  grades: Partial<Record<string, 1 | 2 | 3 | 4>>;
  aerobicScore?: number;
  anaerobicScore?: number;
} {
  const grades: Partial<Record<string, 1 | 2 | 3 | 4>> = {};
  const anaScores: number[] = [];
  const aerScores: number[] = [];

  for (const r of results) {
    if (r.skipped || r.best === 0) continue;
    switch (r.type) {
      case '10m': {
        const g = gradeTime(r.best, NORMS_10M, sex);
        grades['10m'] = g;
        anaScores.push((g / 4) * 100);
        break;
      }
      case '30m': {
        const g = gradeTime(r.best, NORMS_30M, sex);
        grades['30m'] = g;
        anaScores.push((g / 4) * 100);
        break;
      }
      case 'cmj': {
        const g = gradeMag(r.best, NORMS_CMJ, sex);
        grades['cmj'] = g;
        anaScores.push((g / 4) * 100);
        break;
      }
      case 'broad_jump': {
        const g = gradeMag(r.best, NORMS_BROAD_JUMP, sex);
        grades['broad_jump'] = g;
        anaScores.push((g / 4) * 100);
        break;
      }
      case 'rsa': {
        if (r.rsaMeanTime && r.rsaMeanTime > 0) {
          const g = gradeTime(r.rsaMeanTime, NORMS_RSA_20M, sex);
          grades['rsa'] = g;
          anaScores.push((g / 4) * 100 * 0.5);
          aerScores.push((g / 4) * 100 * 0.5);
        }
        if (r.fatigueIndex !== undefined && r.fatigueIndex >= 0) {
          const g = gradeTime(r.fatigueIndex, NORMS_FI, sex);
          grades['rsa_fi'] = g;
          aerScores.push((g / 4) * 100);
        }
        break;
      }
      case 'yoyo': {
        const g = gradeMag(r.best, NORMS_YOYO, sex);
        grades['yoyo'] = g;
        aerScores.push((g / 4) * 100);
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
    rsaSprints: rsa?.rsaAllSprints?.filter(t => t > 0),
    yoyoLevel: get('yoyo')?.best,
    sex: session.sex,
    completedAt: session.completedAt,
  };
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
