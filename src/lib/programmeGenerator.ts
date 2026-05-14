/**
 * AI Programme Generator v2
 * Elite football S&C — individualised, periodised, force-velocity aligned.
 * Deterministic: identical inputs → identical programme.
 */

import {
  GeneratedProgramme, ProgrammeInputs, ProgrammeWeek, ProgrammeSession,
  ProgrammeExercise, ReadinessLevel, MethodType, IntensityIntent,
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

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
  return { name, sets, reps, rest, cue, ...opts };
}



// ── Readiness — 4-band (1–5 scale) ────────────────────────────────────────
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
  const raw = (safe.sleep + (6 - safe.fatigue) + (6 - safe.soreness) + (6 - safe.stress)) / 4;
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

// ── Duration from experience ───────────────────────────────────────────────

function durationWeeks(exp: string): number {
  return exp === '<1' ? 6 : exp === '1-3' ? 8 : exp === '3-5' ? 10 : 12;
}

function resolvedDuration(inputs: { experienceYears: string; customDurationWeeks?: number }): number {
  if (inputs.customDurationWeeks && inputs.customDurationWeeks > 0) return inputs.customDurationWeeks;
  return durationWeeks(inputs.experienceYears);
}

// ── Phase ──────────────────────────────────────────────────────────────────

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

// ── Off-season schedule — no MD loading, DOMS/fatigue managed by spacing ──
// Heavy sessions spaced ≥72h apart. Moderate sessions fill gaps.
// Pattern: Heavy → Moderate → Heavy (or Heavy → Heavy for 2x/week with 72h gap).

type OsSlot = { dayOfWeek: string; load: 'heavy' | 'moderate' };

const OFF_SEASON_SCHEDULES: Record<number, OsSlot[]> = {
  2: [
    { dayOfWeek: 'Tuesday',  load: 'heavy' },
    { dayOfWeek: 'Friday',   load: 'heavy' },     // 72h gap each way
  ],
  3: [
    { dayOfWeek: 'Monday',   load: 'heavy' },
    { dayOfWeek: 'Wednesday', load: 'moderate' },  // 48h — moderate to manage DOMS
    { dayOfWeek: 'Friday',   load: 'heavy' },      // 48h — recovered from Wed
  ],
  4: [
    { dayOfWeek: 'Monday',   load: 'heavy' },
    { dayOfWeek: 'Tuesday',  load: 'moderate' },   // 24h — moderate only
    { dayOfWeek: 'Thursday', load: 'heavy' },      // 48h — recovered
    { dayOfWeek: 'Friday',   load: 'moderate' },   // 24h — moderate only
  ],
};

// ── MD schedule ────────────────────────────────────────────────────────────

type MdSlot = { mdDay: string; dayOfWeek: string };

const SCHEDULES: Record<string, Record<number, MdSlot[]>> = {
  saturday: {
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-2', dayOfWeek: 'Thursday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Sunday' }, { mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
  },
  sunday: {
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-2', dayOfWeek: 'Friday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Monday' }, { mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
  },
  midweek: {
    2: [{ mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    4: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-2', dayOfWeek: 'Monday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
  },
};

function getMdSlots(sessionsPerWeek: number, matchDay: string): MdSlot[] {
  const schedule = SCHEDULES[matchDay] ?? SCHEDULES.saturday;
  return schedule[sessionsPerWeek] ?? schedule[3];
}

// ── Force-velocity profile per session ────────────────────────────────────
// Balanced: MD-4 = strength end; MD-3 = speed end; MD-2 = middle of curve

function getFVProfile(mdDay: string): {
  profile: string;
  loadScheme: 'heavy' | 'moderate' | 'light';
  repRange: 'low' | 'medium' | 'high';
} {
  if (mdDay === 'MD-4') return {
    profile: 'Heavy strength day. High load, low reps, explosive intent on every rep.',
    loadScheme: 'heavy', repRange: 'low',
  };
  if (mdDay === 'MD-3') return {
    profile: 'Structural day. Moderate load, higher reps, eccentric emphasis. DOMS peaks at 48h — will be fully cleared by match day.',
    loadScheme: 'moderate', repRange: 'medium',
  };
  if (mdDay === 'MD-2') return {
    profile: 'Conditioning day. Moderate effort, low-impact cross-training only.',
    loadScheme: 'moderate', repRange: 'medium',
  };
  return {
    profile: 'Neural priming. Short, sharp, high-quality output. No fatigue accumulation.',
    loadScheme: 'light', repRange: 'medium',
  };
}

// ── Warm-up blocks ─────────────────────────────────────────────────────────

const WARMUP_MOBILITY = [
  ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Drive lead knee toward the floor. Breathe into end range — never force it.',
    { methodType: 'isometric', intensityIntent: 'controlled' }),
  ex("World's Greatest Stretch", '1', '5 each side', '', 'Lunge forward, thoracic rotation, reach ceiling. Eyes follow the hand.',
    { methodType: 'mixed', intensityIntent: 'controlled' }),
  ex('Glute Bridge Hold + March', '2', '8 each leg', '30s', 'Full hip extension. Pelvis stays level as you march.',
    { methodType: 'isometric', intensityIntent: 'controlled', tempo: '1-2-1-0' }),
];

const WARMUP_NEURAL = [
  ex('Lateral Shuffle', '2', '15 steps each way', '30s', 'Stay low — hips below shoulders. Push off outside foot each step. Do not cross feet. Groin activation and lateral movement prep.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
  ex('A-Skip', '2', '2 × 20m', '30s', 'Knee to hip height. Claw foot back down. Tall posture, relaxed shoulders.',
    { intensityIntent: 'moderate' }),
  ex('High Knees', '2', '20m', '20s', 'Punch knees fast. Land ball of foot. Rapid arm action.',
    { intensityIntent: 'moderate' }),
];

// WARMUP_SPEED retained as reference for future speed-day sessions
const WARMUP_SPEED_REF = null as unknown as ProgrammeExercise[];
void WARMUP_SPEED_REF;

const WARMUP_STRENGTH = [
  ex('Air Squat (Activation)', '2', '10', '30s', 'Elbows inside knees at the bottom. Drive knees out. Full depth. No equipment needed — bodyweight only.',
    { methodType: 'concentric', intensityIntent: 'controlled', tempo: '3-0-1-0' }),
  ex('Prone T-Y-I (Scapular Activation)', '2', '8 each shape', '20s', 'Lie face down. For T: arms out to sides, thumbs up. Y: arms 45° overhead. I: arms overhead. Squeeze shoulder blades on each rep. No equipment needed — scapular stability for every training environment.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
];

// ── Strength library — by phase × gym access × load scheme ────────────────
// Science: concentric compound lifts ONLY here. Eccentrics are in ECCENTRIC_BLOCK (always last).
// Sets: 2–3 max (athlete-specific volume). Load: 80%+ Foundation → 85%+ Build → 88%+ S&P → 90%+ Peak.
// Bar speed autoregulation: stop any set when velocity drops >20% vs set 1 — that is the daily ceiling.

type GymKey = 'full' | 'basic' | 'none';
type LoadKey = 'heavy' | 'moderate';

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

// ── Bulgarian Split Squat Library — vertical compound alternative ──────────
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
function useBackSquat(inputs: ProgrammeInputs, phase: string): boolean {
  if (inputs.gymAccess === 'none') return false; // no barbell = no back squat
  // BSS hard overrides:
  if (inputs.primaryGoal === 'speed') return false;
  if (!inputs.offSeason) return false; // in-season → always BSS
  if (inputs.injuryHistory.some(a => a === 'back' || a === 'hamstring')) return false;
  // Back Squat eligible:
  if (phase === 'Foundation') return true; // General Strength phase
  if (inputs.preferBackSquat) return true; // player preference / plateau signal
  return false;
}

/** Select vertical compound — Back Squat or BSS — based on athlete context. */
function selectVerticalSquat(
  inputs: ProgrammeInputs,
  phase: string,
  gymKey: GymKey,
  loadScheme: LoadKey,
  strengthEx: ProgrammeExercise[],
): ProgrammeExercise {
  if (useBackSquat(inputs, phase)) {
    return strengthEx[0]; // Back Squat from STRENGTH_LIBRARY
  }
  const bssPhase = BSS_LIBRARY[phase] ?? BSS_LIBRARY.Build;
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

// ── Max Velocity Block — sprinting & jumping FIRST (fresh CNS required) ────
// Science: max velocity sprinting and jumping require a completely fresh nervous system.
// Always immediately after warm-up, BEFORE any heavy strength work.
// No weighted exercises — sprints and jumps only.

// Explosive plyometrics: low reps (2–3), long rest (3 min). Max CNS output every rep.
// These are NOT conditioning — every rep must be 100% intent. Full 3 min rest is non-negotiable.
const POWER_PRIMER: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Broad Jump', '3', '3', '3:00', 'EXPLOSIVE — 3 reps, full 3 min rest. Max horizontal displacement every rep. Swing arms back, load hips, drive hard. Stick the landing — absorb with hips and knees. Full reset between reps: this is maximal neural output, not conditioning.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Box Jump', '3', '3', '3:00', 'EXPLOSIVE — 3 reps, full 3 min rest. Step back, drive arms, explode onto box. Land softly in partial squat. Step down every time — never jump down. Complete CNS reset between reps.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  basic: [
    ex('Broad Jump', '3', '3', '3:00', 'EXPLOSIVE — 3 reps, full 3 min rest. Max horizontal displacement every rep. Drive arms, load hips, push the ground back hard. Stick the landing. Full reset between reps: maximal neural output only.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Box Jump', '3', '3', '3:00', 'EXPLOSIVE — 3 reps, full 3 min rest. Step back, drive arms, explode onto box. Land softly in partial squat. Step down every time — never jump down. Complete CNS reset between reps.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  none: [
    ex('Countermovement Jump', '3', '3', '3:00', 'EXPLOSIVE — 3 reps, full 3 min rest. Arms back, deep dip, drive hard through the ceiling. Max height every rep. Full CNS reset between reps: this is maximal neural output, not conditioning.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Broad Jump', '3', '2', '3:00', 'EXPLOSIVE — 2 reps, full 3 min rest. Max horizontal displacement. Swing arms, load hips, drive. Stick the landing. Full reset between every rep.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
};

// ── Tendon & SSC Block — between strength and eccentrics ──────────────────
// Science: tendon stiffness = heavy slow resistance isometrics + fast reactive plyometrics (short GCT).
// Placed AFTER strength (not fatigued by strength), BEFORE eccentrics.
// Heavy isometrics → tendon structural adaptation. Pogo hops → fast SSC tendon spring.

// Tendon physiology: Heavy Slow Resistance (HSR) isometrics → increased tendon stiffness → tendon
// absorbs more of the sprint/jump load, so the muscle doesn't overwork → reduced patellar + Achilles risk.
// Two HSR exercises per session: one patellar-tendon dominant (split squat), one Achilles-dominant (calf hold).
// Pogo hops = fast SSC — trains the tendon spring at match-speed loading rates.
const TENDON_SSC_BLOCK: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Isometric Split Squat Hold (Heavy)', '3', '10-12s each leg', '90s', 'Bottom of split squat — rear knee 2cm from floor. Add load via barbell or heavy DB. Maximum effort throughout — zero relaxing. Patellar tendon HSR: brief maximal holds at ≥90% MVC optimise tendon stiffness (Arampatzis et al. 2010). Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '2', '8-10s each leg', '90s', 'Rise onto single-leg tiptoe. Hold at the top. Add weight via DB or barbell if available. Maximum effort. Achilles tendon HSR — brief ≥90% MVC holds maximise Achilles stiffness adaptation (Fouré et al. 2011). Tendon stiffness driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Ankles STIFF — no dorsiflexion. Arms punch up. Minimum ground contact time. High frequency tendon-spring training: the isometric holds above build stiffness, pogos train the elastic SSC return at match-speed loading rate.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  basic: [
    ex('Isometric Split Squat Hold (Heavy DB)', '3', '10-12s each leg', '90s', 'Bottom of split squat. Hold heaviest available DB. Maximum effort throughout. Patellar tendon HSR — brief maximal holds at ≥90% MVC drive greater tendon stiffness than longer submaximal holds (Arampatzis et al. 2010). Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '2', '8-10s each leg', '90s', 'Single-leg tiptoe hold. Hold heavy DB at side. Maximum effort. Achilles tendon HSR — brief ≥90% MVC holds maximise Achilles stiffness adaptation (Fouré et al. 2011). Achilles health driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Stiff ankles. Minimum ground contact time. Elastic tendon return — train the spring at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  none: [
    ex('Isometric Split Squat Hold (Bodyweight)', '3', '10-12s each leg', '90s', 'Bottom of split squat, rear knee 2cm from floor, bodyweight. Maximum effort throughout — every second should feel hard. Brief maximal holds at ≥90% MVC drive patellar tendon stiffness (Arampatzis et al. 2010). Tendon stiffness driver.',
      { tempo: '0-12s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise)', '2', '8-10s each leg', '90s', 'Rise onto single-leg tiptoe. Hold maximum effort. Achilles HSR — brief ≥90% MVC holds maximise stiffness adaptation (Fouré et al. 2011). Tendon absorbs sprint load. Achilles health driver.',
      { tempo: '0-10s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'REACTIVE — 20 reps, 90s rest. Ankles stiff. Minimum ground contact. Elastic SSC tendon return at match-speed.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
};

// ── Priority Isometric Block ───────────────────────────────────────────────
// Exactly 3 isometrics every session. No light isometrics anywhere.
// 1. Isometric Split Squat (Heavy)  — patellar tendon stiffness driver
// 2. Single-Leg Calf Isometric      — Achilles health driver
// 3. Dead Bug                       — core/pelvic stability for sprinting

const DEAD_BUG: ProgrammeExercise = ex(
  'Dead Bug',
  '2', '8 each side', '60s',
  'Lower back PRESSED into floor throughout — this is non-negotiable. Extend opposite arm and leg simultaneously, hold 1s at full extension, return under control. Do not lose lumbar contact at any point. Core/pelvic stability for sprinting: trains anti-extension stiffness that keeps your pelvis neutral during max-velocity running. No equipment needed.',
  { methodType: 'isometric', intensityIntent: 'maximal' },
);

/** Returns the 3 priority isometrics for any session. Always exactly 3 — no more. */
function buildIsometricBlock(gymKey: GymKey): ProgrammeExercise[] {
  return [
    TENDON_SSC_BLOCK[gymKey][0], // Isometric Split Squat (Heavy) — tendon stiffness
    TENDON_SSC_BLOCK[gymKey][1], // Single-Leg Calf Isometric (Heel Raise) — Achilles
    DEAD_BUG,                    // Dead Bug — core/pelvic stability
  ];
}

// ── Eccentric Block — ALWAYS placed last in every session ────────────────
// Fascicle length physiology: eccentric contractions lengthen the muscle under tension →
// individual sarcomeres are trained at a longer length → the muscle can handle a longer stretch
// before individual sarcomeres "pop" (the mechanism of strain injury at high-speed running).
// Nordic Curl = highest-evidence fascicle-length exercise. Always included, always last.
// Eccentric RDL = complements Nordics — adds posterior chain fascicle length at the hip hinge pattern.
// Copenhagen Plank = adductor eccentric + isometric. Most evidenced groin prevention in football.

const ECCENTRIC_BLOCK: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Nordic Hamstring Curl', '3', '2', '3:00', '4s controlled lowering — maximum effort, fight the fall with everything. 2 reps only: every rep must be truly maximal. Physiology: eccentric lengthening increases hamstring fascicle length. Longer fascicles = individual sarcomeres operate over a wider range before failure — the primary mechanism reducing hamstring tear risk at high-speed running. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '2', '15s each side', '90s', 'Top foot on bench, bottom leg free. Adductor eccentric — groin strain prevention. Most evidenced single exercise for groin protection in football (Harøy et al. 2019). Build hold time by 3-5s each week.',
      { tempo: '0-15s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  basic: [
    ex('Nordic Hamstring Curl', '3', '2', '3:00', '4s controlled lowering. Maximum effort — fight the fall with everything. 2 reps only: each rep fully maximal. Partner anchors feet or secure under heavy furniture. Fascicle length adaptation: longer sarcomere operating range = reduced strain risk at max sprint. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '2', '25s each side', '90s', 'Top foot on bench, hips free. Adductor eccentric + isometric. Groin strain prevention — highest evidence in football. Add 5s per week.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  none: [
    ex('Nordic Hamstring Curl', '3', '2', '3:00', '4s controlled lowering. Maximum effort — fight the fall completely. 2 reps only: each rep truly maximal. Anchor feet under sofa/door or use a partner. Fascicle length adaptation: the primary mechanism reducing hamstring tear risk at high-speed running. Non-negotiable every session.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Copenhagen Plank', '2', '25s each side', '90s', 'Top foot on chair/bench, hips free. Adductor eccentric. Groin prevention. Build 5s per week.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
};

// ── Upper body — gym-access-aware ──────────────────────────────────────────
// full: barbell + cable + machines available
// basic: barbells + dumbbells only (no cables, machines, or sled)
// none: bodyweight only (push-ups, inverted rows, pike push-ups)

const UPPER: Record<string, Record<GymKey, ProgrammeExercise[]>> = {
  Foundation: {
    full: [
      ex('DB Bench Press', '3', '6', '2:30', 'Retract shoulder blades. Explosive push — treat every rep like a max attempt. 2 RIR. DBs allow full range — use it.',
        { intensity: '75% effort', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Row', '3', '6', '2:00', 'Hinge 45°. Pull elbow hard to hip. Squeeze lat at the top. Maximum intent — not a warm-down.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Shoulder Press', '3', '6', '2:00', 'Drive bar straight up. Brace through the core. Full lockout every rep. 2 RIR.',
        { intensity: '75% effort', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    basic: [
      ex('DB Bench Press', '3', '6', '2:30', 'Explosive push. Full range. 2 RIR. DBs allow natural arc — elbows at 45°, not flared.',
        { intensity: '75% effort', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Bent-Over Row', '3', '6', '2:00', 'Hinge at 45°. Pull bar to lower chest hard. Squeeze lats at top. Explosive pull.',
        { intensity: '75% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Shoulder Press', '3', '6', '2:00', 'Neutral spine. Drive hard. Full lockout overhead. 2 RIR.',
        { intensity: '75% effort', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Push-Up (Max Effort)', '3', '6', '2:00', 'Hands just outside shoulders. Lower chest within 3cm of floor. Drive up explosively — leave the floor if possible. 2 RIR, not a comfortable set.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Table or Low Bar)', '3', '6', '2:00', 'Pull chest hard to bar. Heels on floor, body straight. Maximum effort — add a backpack for load if 6 reps is easy.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up', '3', '6', '90s', 'Hips high, inverted V. Lower head toward floor. Explode back up. 2 RIR. Vertical push at max effort.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  Build: {
    full: [
      ex('Bench Press', '3', '5', '3:00', 'Explosive push. 2 RIR. Bar speed is your autoregulation — rack when velocity drops. Heavy horizontal push.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '3', '4', '3:00', 'Dead hang start. Drive elbows down hard. Chin over bar. Add 5–10kg. 2 RIR.',
        { intensity: 'Add 5–10kg', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '4', '2:30', 'Dip and drive hips explosively. Aggressive lockout. Bar over heels. Maximum rate of force development.',
        { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '3', '5', '3:00', 'Explosive push. 2 RIR. Bar moves fast. Barbell allows heavier load — use it.',
        { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Bent-Over Row', '3', '5', '2:30', 'Pull bar to lower chest explosively. Horizontal pull for upper back strength. 2 RIR.',
        { intensity: '78% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '3', '5', '2:30', 'Dip and drive hips. Explosive lockout overhead. DBs allow each arm to work independently.',
        { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Plyometric Push-Up', '3', '6', '2:30', 'Explosive push — hands leave the floor. Land softly. Maximum upper body power expression. Every rep full intent.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Table or Low Bar)', '3', '6', '2:00', 'Pull chest hard to bar, heels on floor. Max effort — elevate feet if 6 reps is not near failure.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up', '3', '6', '2:00', 'Hips high. Lower head toward floor. Drive up hard. Vertical push at max effort.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
  'Strength & Power': {
    full: [
      ex('Bench Press', '3', '3', '3:30', 'Maximum force intent. Bar moves with authority every rep. 1–2 RIR. Heavy horizontal push.',
        { intensity: '84% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '3', '3', '3:00', 'Drive elbows down hard. Explosive concentric. 1–2 RIR. Add enough weight to make 3 reps a real effort.',
        { intensity: 'Challenging', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '4', '2:30', 'Dip and drive hips aggressively. Lockout at full extension. Maximum rate of force development.',
        { intensity: '78% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '3', '4', '3:30', 'Maximum force intent. Bar moves fast on every rep. 1–2 RIR.',
        { intensity: '83% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Bent-Over Row', '3', '4', '3:00', 'Pull bar to lower chest with intent. Explosive pull. 1–2 RIR.',
        { intensity: '82% 1RM', tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '3', '4', '2:30', 'Dip and drive hips. Explosive lockout. Maximum rate of force development.',
        { intensity: 'Heavy DB', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Archer Push-Up', '3', '5 each side', '3:00', 'Wide hands. Lower to one side — that arm takes full load. Alternate sides. Maximum effort, unilateral bodyweight strength.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Feet Elevated)', '3', '6', '2:30', 'Feet elevated, pull chest to bar. Maximum effort — close to failure. Maximal bodyweight horizontal pull.',
        { tempo: '1-1-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up (Deficit)', '3', '6', '2:00', 'Hands on elevated surface. Increase depth below hand level. Drive hard on every rep. Max effort vertical push.',
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
      ex('Barbell Bent-Over Row', '2', '3', '3:30', 'Peak horizontal pull. Maximum intent. Full rest.',
        { intensity: '86% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Explosive Push-Up', '2', '5 @ 1 RIR', '3:00', 'Maximum explosive intent on every rep. 1 RIR. Peak bodyweight upper expression.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Feet Elevated)', '2', '6 @ 1 RIR', '3:00', 'Peak bodyweight horizontal pull. 1 RIR. Full rest between sets.',
        { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
  },
};

// ── Speed-acceleration by phase ────────────────────────────────────────────

const SPEED_ACCELERATION: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('Falling Start', '4', '10m', '2:00', 'Ankle lean, first step drives. Low body angle for first 6 steps.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('Standing Start Sprint', '4', '15m', '2:00', 'Staggered stance. Explode — stay low until 10m.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
  ],
  Build: [
    ex('3-Point Start Sprint', '5', '20m', '2:30', 'Rear leg drives. Build body angle progressively. Push into the ground.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Sprint from Back-Pedal', '4', '5m back → 15m fwd', '2:30', 'Back-pedal, plant, drive. Simulate match transition.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
  ],
  'Strength & Power': [
    ex('Resisted Sled Sprint', '4', '20m', '3:00', '45° lean into sled. Long powerful steps. Full extension.',
      { intensity: 'Heavy sled', methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Flying 10m Sprint', '4', '30m build → 10m fly', '4:00', 'Reach max velocity. Hold it. Time the flying 10m.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
  ],
  Peak: [
    ex('Flying 20m Sprint', '5', '40m build → 20m fly', '4:30', 'Maximum velocity. Full rest. Quality every rep.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Sprint from Lateral Start', '3', '20m', '3:00', 'Crossover step, drive. Match sprint trigger simulation.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
  ],
};

// ── Position-specific speed content ───────────────────────────────────────

type PosKey = 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';

const POSITION_SPEED: Partial<Record<PosKey, ProgrammeExercise[]>> = {
  GK: [
    ex('Explosive Lateral Bound + Stabilise', '4', '4 each', '2:00', 'Push off outside foot. Land inside foot, absorb deeply. Simulate diving saves.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Reaction Sprint (Varied Direction)', '4', '10m', '2:00', 'Start in ready position. Sprint on verbal cue — direction varies. React, don\'t anticipate.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  CB: [
    ex('Deceleration Sprint', '4', '30m sprint → hard stop', '3:00', 'Sprint 30m, plant hard, 3–5 step controlled brake. Train braking mechanics.',
      { methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Back-Pedal → Forward Sprint', '4', '10m back → 20m fwd', '3:00', 'Track a runner. Hip-turn signal. Explosive change of direction.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
  ],
  FB: [
    ex('Sprint + Lateral Shuffle + Sprint', '4', '10m → 10m → 10m', '3:00', 'Match simulation. Sprint, shuffle, close sprint. Quality throughout.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Repeated 40m Sprint', '5', '40m', '25s', 'Build RSA. 90% each rep. Discipline is in the short rest.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
  ],
  CM: [
    ex('Sprint from Jog', '5', '20m', '90s', 'Simulate match sprint — transition from cruising to max effort.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Box-to-Box Run Simulation', '4', '50m', '60s', '85% effort. Midfield sprint pattern. Controlled deceleration.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
  ],
  W: [
    ex('Flying 20m Sprint', '6', '40m build → 20m fly', '4:00', 'Your primary weapon. Max velocity every rep. Full rest.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Curve Sprint', '3', '30m curve', '3:00', 'Wide sprint with inside lean. Maintain speed through the bend.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
  ],
  ST: [
    ex('10m Explosive Burst', '6', '10m', '2:00', 'From varied positions. Max first-step intent. Striker run simulation.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Sprint + Jump (Aerial Duel)', '4', '15m sprint → CMJ', '3:00', 'Sprint, jump at cone, land and decelerate. Penalty box simulation.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
  ],
};

// ── Play-style specific exercises ──────────────────────────────────────────

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
    ex('Isometric Split Squat Hold', '3', '30s each', '2:00',
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

// Non-running play-style gym exercises (strength / isometric / plyometric)
const PLAY_STYLE_EX: Record<string, ProgrammeExercise[]> = {
  'box-to-box': [],
  'direct': [],
  'technical': PLAY_STYLE_RUNNING['technical'],
  'physical': PLAY_STYLE_RUNNING['physical'],
  'press-heavy': [],
  'counter-attack': [],
};

// ── Conditioning by position × phase ──────────────────────────────────────

// Running-based conditioning — MD-2 uses CONDITIONING_MD2 (low-impact bike/pool).
// Each position × phase has 4 variants rotated weekly (weekNum % 4) for session variety.
const CONDITIONING: Record<PosKey, Record<string, ProgrammeExercise[]>> = {
  GK: {
    Foundation: [ex(
      'GK Aerobic Base — Reaction Shuttle Circuit',
      '4', '6 × 20m shuttles (2 min per set)', '2:00 between sets',
      `🎯 TARGET: Zone 2 aerobic base | HR 130–150 bpm (65–75% max HR)

SESSION PLAN:
Set up 3 cones in a line, 10m apart (20m total shuttle).

Each set: jog to cone 2 (10m), change direction, sprint to cone 3 (10m), change direction, jog back. Repeat 6 times continuously.

Pace: 70–75% effort on the sprint legs. You should be breathing hard but able to speak in short sentences. If HR climbs above 155 bpm, slow down slightly on the jog sections.

GK FOCUS: On each direction change, drop your hips and push off the outside foot — mimic a save-and-reset movement. Stay light on your feet.

WHY: Goalkeepers cover 5–6 km per match with frequent short bursts. This builds the aerobic engine that powers your recovery between high-intensity moments.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('GK Aerobic Base — Wide Lateral Shuffle Circuit', '3', '8 × 30m lateral shuttles', '2:00 between sets',
      `🎯 TARGET: Zone 2 aerobic base | HR 130–150 bpm

SESSION PLAN: Place cones 15m apart. Shuffle laterally 15m right, then 15m left = 1 rep. Complete 8 reps per set, 3 sets total. Stay low — hips below shoulders at all times. Touch each cone with outside hand.

GK FOCUS: Every direction change mimics the GK resetting position. Stay on balls of feet, never cross feet. This is the lateral movement pattern you repeat 50+ times per match.

WHY: Goalkeepers' aerobic base is built primarily through lateral movement, not forward running. This trains your specific energy system.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('GK Aerobic Base — Cone Weave Jog Circuit', '4', '4 min continuous', '90s rest',
      `🎯 TARGET: Zone 2 | HR 130–145 bpm throughout

SESSION PLAN: Set up 8 cones in a zigzag pattern, 5m apart. Jog through continuously for 4 minutes — weave forward, back-pedal, lateral shuffle alternating. Rest 90s. 4 rounds total.

GK FOCUS: Change direction at every cone using goalkeeper footwork — push off outside foot, open hips. Never coast — keep HR above 130 bpm the whole round.

WHY: Continuous low-intensity movement through changing directions builds the GK-specific aerobic base while reinforcing movement patterns.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('GK Aerobic Base — 15m Sprint + Walk Recovery Circuit', '5', '6 × 15m (2 min continuous)', '2:30 between sets',
      `🎯 TARGET: Zone 2–3 | HR 135–155 bpm

SESSION PLAN: Sprint 15m at 75% effort, walk back slowly (30s). Repeat 6 times continuously per set, 5 sets total. The walk is your recovery — don't rush it.

GK FOCUS: Sprint from GK stance — slight crouch, weight forward. Explosive first step. This models your charge-out movement on crosses.

WHY: Repeated short sprint-walk cycles at controlled intensity build the aerobic engine that sustains GK explosiveness over 90 minutes.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ],

    Build: [ex(
      'GK Anaerobic Capacity — 10s Max Sprint / 20s Walk',
      '1', '8 rounds (4 min total)', '3:00 walk after all rounds',
      `🎯 TARGET: Zone 4–5 anaerobic | HR >85% max HR during sprints

SESSION PLAN:
Mark a 15m line. Stand behind the line.

Round 1–8: On your go, sprint 15m at 100% effort. Stop. Walk back slowly (10s). Sprint again immediately at the 20s mark.

The sprint must be maximal every rep — if you can't maintain 90%+ effort, extend the walk to 30s for remaining reps.

GK FOCUS: Start each sprint from a realistic GK stance — feet shoulder-width, slight hip hinge, weight on balls of feet. Mirror your starting position from a set-piece or corner.

WHY: A GK's decisive moments are explosive 3–5m dives and reaction saves. Short maximal sprints with full recovery train the phosphocreatine (PCr) system that powers these efforts.`,
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    ex('GK Anaerobic Capacity — Lateral Explosion Intervals', '4', '5 × 5m lateral burst', '2:30 between sets',
      `🎯 TARGET: Zone 4–5 | Maximal explosive output each rep

SESSION PLAN: Mark 5m laterally. From GK ready stance, explode laterally — drive off inside foot, reach full extension. 5 reps per set (alternating direction), 2:00 between reps within set, 2:30 between sets. 4 sets total.

GK FOCUS: Every rep should mimic a full-extension diving save — explosive push-off, full body reach. Land and reset completely before the next rep.

WHY: Goalkeepers' most decisive actions are lateral dives of 2–5m. This trains the exact energy system and movement pattern used on those game-defining moments.`,
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    ex('GK Anaerobic Capacity — 10m Sprint Clusters', '5', '3 × 10m (20s between)', '3:00 between sets',
      `🎯 TARGET: Zone 4–5 | >90% effort every sprint, full set recovery

SESSION PLAN: 3 × 10m sprints with 20s walk rest between reps = 1 cluster. 3:00 full rest between the 5 clusters. Start each sprint from a different GK position: set 1 crouched, set 2 standing, set 3 back to sprint direction.

GK FOCUS: The cluster of 3 sprints mirrors a GK's sequence in active play — save → distribute → sprint to position. The burn on rep 3 of each cluster is the adaptation stimulus.

WHY: Cluster training matches actual GK activity patterns — repeated explosive efforts with incomplete intra-cluster recovery, then full rest.`,
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    ex('GK Anaerobic Capacity — 20m Shuttle Intervals', '6', '20m shuttle', '45s rest',
      `🎯 TARGET: Zone 4–5 | HR 175–190 bpm, incomplete recovery

SESSION PLAN: Sprint 10m to a cone, plant, sprint 10m back = 1 rep. 45s walk rest. 6 reps total. Every rep must be genuine max effort. If pace drops >15% from rep 1, extend rest to 60s.

GK FOCUS: Plant and change direction with a drop step — outside foot plants, hips open, drive back. Same mechanics as GK movement to cross.

WHY: 20m shuttle at this intensity trains the anaerobic capacity GKs need for repeated explosive positional adjustments throughout a match.`,
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    ],

    'Strength & Power': [ex(
      'GK Speed-Endurance — Flying 20m Repeats',
      '6', '20m', '45s rest',
      `🎯 TARGET: Zone 4 speed-endurance | HR 170–185 bpm, partial recovery between reps

SESSION PLAN:
Set up a 10m run-up and a 20m flying zone (30m total distance).

Reps 1–6: Accelerate over 10m, then hit top speed through the 20m flying zone. Decelerate safely beyond.

Rest = 45s standing rest between each rep. This is deliberate incomplete recovery — training your ability to repeat high-speed efforts.

GK FOCUS: During the flying zone, drive your arms aggressively. A goalkeeper distributing from goal and sprinting to close down crosses needs the ability to reach near-maximum speed in a short time.

WHY: Flying sprints develop maximum velocity while the short rest window trains GK-specific repeated high-speed output.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('GK Speed-Endurance — 15m Acceleration Repeats', '8', '15m', '40s rest',
      `🎯 TARGET: Zone 4–5 | 95% effort every rep, very short recovery

SESSION PLAN: Sprint 15m at 95% effort. 40s walk rest. 8 reps total. Start alternating from standing (odd reps) and a jogging approach (even reps). Every rep must be a genuine sprint — not a tempo run.

GK FOCUS: Even reps (jogging approach) simulate a GK moving across goal and then exploding forward. The transition from jog to sprint in 2 steps is a real GK movement pattern.

WHY: Short repeated sprints at near-maximum intensity build the speed-endurance that keeps a GK sharp and explosive deep into the second half.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('GK Speed-Endurance — 5-10-5 Agility Sprints', '6', 'full shuttle', '60s rest',
      `🎯 TARGET: Zone 4–5 | Max agility speed, 60s near-full recovery

SESSION PLAN: Place 3 cones — a centre cone and one each 5m left and right. Start at centre: sprint 5m right, plant, sprint 10m left, plant, sprint 5m back to centre = 1 rep. 60s walk rest. 6 reps. Alternate which direction you start.

GK FOCUS: The 5-10-5 is the most GK-relevant agility drill — it matches the distance and direction change of a near-post to far-post dive. Every plant must be explosive, not passive.

WHY: Builds the GK-specific change-of-direction speed and speed-endurance simultaneously.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('GK Speed-Endurance — 30m Repeated Sprints', '5', '30m', '50s rest',
      `🎯 TARGET: Zone 4–5 | 90% effort, incomplete 50s recovery

SESSION PLAN: Sprint 30m at 90% effort. 50s walk rest. 5 reps. Vary starting position: reps 1 and 3 from stationary, reps 2 and 4 from back-pedal, rep 5 from lateral start.

GK FOCUS: Rep 5 from lateral start simulates a GK caught out of position — a cross is played in behind and the GK has to sprint to recover. Train this exact moment.

WHY: Repeated 30m sprints with varied starts build the speed-endurance and positional recovery ability that defines elite GK athleticism.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'GK CNS Activation — Reactive Short Sprints',
      '3', '4 × 10m (15s between reps)', '2:30 between sets',
      `🎯 TARGET: Zone 5 CNS activation | HR >90% during sprints, full rest between sets

SESSION PLAN:
Mark 10m. Set up a partner or use an audio cue (clap).

Each set: 4 × 10m sprints with 15s rest between reps. 2:30 full rest between the 3 sets.

Trigger: Every sprint starts from a REACTION CUE — partner points left or right, you sprint to a cone 10m in that direction. This makes every rep reactive, not anticipatory.

GK FOCUS: Use your GK drop-step technique — push off the direction foot first, hips open to the line of sprint. Same movement as crossing-ball recovery.

WHY: Low-volume, high-quality CNS priming ahead of match week. Keeps the nervous system sharp without generating fatigue that carries into match day.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('GK CNS Activation — Dive + Sprint Combo', '4', '3 × (dive + 10m sprint)', '3:00 between sets',
      `🎯 TARGET: Zone 5 | MAX explosive intent, full recovery between sets

SESSION PLAN: Drop to one knee (simulated diving save), explode back up, sprint 10m at 100% = 1 rep. 15s between reps. 3 reps per set. 3:00 full rest between 4 sets. Alternate dive side each rep.

GK FOCUS: The transition from floor to sprint is the critical moment — drive through the floor with your leading foot, swing arms explosively. This is a GK's most demanding athletic pattern.

WHY: Pre-match week neural priming through sport-specific movement patterns. Low volume, maximal output.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('GK CNS Activation — Lateral Burst Protocol', '5', '3m × 4 lateral bursts', '2:30 between sets',
      `🎯 TARGET: Zone 5 | Maximum lateral explosion, full set recovery

SESSION PLAN: 4 cones in a line, 3m apart. Lateral shuffle-burst between cones at maximum speed = 1 set (cover all 4 cones and back). 2:30 full rest. 5 sets. Stay low throughout — hips never rise above knee height.

GK FOCUS: Every direction change is an explosive push — not a deceleration-and-restart. This is the difference between elite GK footwork and average. The plant foot drives the next direction.

WHY: Maximal lateral burst capacity is the defining GK physical quality. These 5 sets prime it for match day without creating fatigue.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('GK CNS Activation — Falling Start Sprints', '6', '10m', '2:00 rest',
      `🎯 TARGET: Zone 5 | Maximum first-step explosive output, full recovery

SESSION PLAN: Stand upright, lean forward (fall start), react to your own tipping point and sprint 10m at 100%. 2:00 full rest. 6 reps. 3 reps from forward lean, 3 reps from side lean.

GK FOCUS: The side lean simulates a GK starting from the opposite post and driving across goal. First-step explosiveness from this position is what wins races to crosses.

WHY: 6 maximal first-step sprints with full recovery is the optimal CNS priming dose — activates the fast-twitch fibres without pre-fatiguing them for match day.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },

  CB: {
    Foundation: [ex(
      'CB Aerobic Base — Deceleration Sprint Circuit',
      '4', '30m sprint + full brake', '2:00 between sets',
      `🎯 TARGET: Zone 3 aerobic threshold | HR 145–165 bpm (75–82% max HR)

SESSION PLAN:
Place a cone at 30m. Start from athletic stance behind the start line.

Sprint 30m at 80% effort. At the cone, perform a HARD deceleration — plant your outside foot, drop your hips, stop within 3 steps. Walk back slowly (rest). Repeat 4 × per set, 4 sets total.

The deceleration is the focus. Control the brake aggressively — this is where CB hamstring and knee injuries occur most. Own it.

CB FOCUS: After the plant-and-brake, immediately reset into a defensive stance — chest up, arms out, weight on balls of feet. Mimic the moment you stop a run and face up to an attacker.

WHY: CBs cover 10–11 km per match, often in hard acceleration-deceleration patterns tracking forwards. This builds the aerobic base AND the eccentric deceleration strength you need.`,
      { methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('CB Aerobic Base — Back-Pedal + Sprint Circuit', '4', '15m back-pedal + 25m sprint', '2:00 between sets',
      `🎯 TARGET: Zone 2–3 | HR 140–160 bpm

SESSION PLAN: Back-pedal 15m (stay upright, hips slightly flexed), plant and explode into a 25m sprint at 80% effort. Walk back = rest. 4 reps per set, 4 sets.

CB FOCUS: The back-pedal → sprint transition is the most common CB movement pattern — tracking a forward then turning to recover. Drive your hip rotation aggressively at the plant step.

WHY: Builds the aerobic base using position-specific movement patterns rather than generic running.`,
      { methodType: 'mixed', intensityIntent: 'controlled' }),
    ex('CB Aerobic Base — 200m Tempo Reps', '5', '200m', '60s rest',
      `🎯 TARGET: Zone 3 | HR 150–165 bpm, sustained for the full 200m

SESSION PLAN: Run 200m at an honest tempo pace — roughly 80% of your best 200m time. 60s walk rest. 5 reps. Aim for consistent splits across all 5 reps — not a sprint on rep 1 and a jog on rep 5.

CB FOCUS: Imagine each 200m as a recovery sprint after a set-piece — you've cleared the ball and now need to get back into position quickly. That urgency translates to better tempo.

WHY: 200m reps at aerobic threshold build the high-end aerobic capacity CBs need for sustained high-tempo defending.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('CB Aerobic Base — Defensive Shape Run', '4', '4 min continuous', '90s rest',
      `🎯 TARGET: Zone 2–3 | HR 140–155 bpm

SESSION PLAN: Continuous 4 min circuit: 20m jog forward → 10m lateral shuffle right → 10m back-pedal → 10m lateral shuffle left → repeat. 90s walk rest. 4 rounds.

CB FOCUS: This is your defensive shape movement pattern — stay in the defensive line, move with the ball. Never break out of the pattern during the 4 minutes.

WHY: Position-specific aerobic conditioning that reinforces defensive movement patterns while building the engine.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ],

    Build: [ex(
      'CB RSA Development — Repeated 30m Sprints',
      '6', '30m', '30s rest',
      `🎯 TARGET: Zone 4 repeated sprint ability | HR 170–185 bpm, incomplete recovery

SESSION PLAN:
Mark 30m on a pitch or track. Start behind the line.

Sprint 30m at 85–90% effort. Immediately walk back to start (this is your ~25–30s rest, including any dead time). Sprint again. 6 total sprints.

If you fall below 80% effort on reps 5–6, extend rest to 45s. Quality beats volume.

CB FOCUS: On odd reps (1, 3, 5) sprint from a standing start. On even reps (2, 4, 6) sprint from a backward jog → turn cue — mimicking tracking a runner then turning to recover.

WHY: CBs make 25–30 high-intensity efforts per match, many after short recovery periods. This trains repeated sprint ability (RSA) directly.`,
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('CB RSA Development — Pro Agility + Sprint Combos', '8', '5-10-5 shuttle', '45s rest',
      `🎯 TARGET: Zone 4 | High HR, incomplete 45s recovery, change-of-direction quality

SESSION PLAN: 3 cones in a line, 5m apart. Start at centre: sprint 5m right, plant, sprint 10m left, plant, sprint 5m to finish. 45s rest. 8 reps, alternating start direction.

CB FOCUS: Each direction change simulates a CB shifting their defensive line — lateral explosion on every plant. The 45s rest ensures HR stays elevated, building RSA while maintaining quality.

WHY: Change-of-direction RSA is a CB's most specific quality — you need to sprint laterally, recover, and sprint again repeatedly.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('CB RSA Development — 40m Sprint + Decel Repeats', '6', '40m + hard stop', '35s rest',
      `🎯 TARGET: Zone 4–5 | 88% effort, hard deceleration at each cone, incomplete recovery

SESSION PLAN: Sprint 40m at 88% effort. Hard brake — stop within 3 steps. Walk back in 35s. 6 reps. Maintain deceleration quality even on rep 5–6 when fatigue sets in.

CB FOCUS: Rep 5–6 with fatigued deceleration is the exact match situation that causes hamstring injuries. Training the decel mechanics under fatigue is protective.

WHY: 40m is the most common CB recovery sprint distance. The hard stop trains eccentric deceleration strength under lactate stress.`,
      { methodType: 'eccentric', intensityIntent: 'submaximal' }),
    ex('CB RSA Development — Back-Pedal Sprint Intervals', '8', '10m back-pedal + 20m sprint', '30s rest',
      `🎯 TARGET: Zone 4–5 | 90% sprint effort, 30s incomplete recovery

SESSION PLAN: Back-pedal 10m at full pace, immediately plant and sprint 20m forward at 90% effort. Walk back in 30s. 8 reps.

CB FOCUS: This is your core defensive pattern — tracking a runner backwards then turning and sprinting. Rep quality on 6–8 matters most. Those are the 88th-minute moments.

WHY: Specifically trains the back-pedal-to-sprint transition that CBs perform 20–30 times per match.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ],

    'Strength & Power': [ex(
      'CB Speed-Endurance — High-Intensity 20m Shuttles',
      '6', '20m', '30s rest',
      `🎯 TARGET: Zone 4–5 lactate tolerance | HR 175–190 bpm, very short recovery

SESSION PLAN:
Place cones 20m apart. Start behind one cone.

Sprint 20m at 100% effort. STOP hard at the cone. Immediately turn and sprint 20m back. That counts as 1 rep. 30s walk rest. Repeat 6 times.

The deceleration at each cone must be aggressive — stop within 3 steps, low hips. This is not a gentle turn-and-jog.

CB FOCUS: Vocalise "hold" to yourself at each deceleration cone — this is the CB's moment of last-ditch defensive recovery where positional discipline decides the outcome.

WHY: Trains lactate tolerance and the eccentric capacity to decelerate at speed — directly transferable to tracking and winning aerial duels at pace.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ex('CB Speed-Endurance — 30-15 Interval Protocol', '1', '12 min continuous', '',
      `🎯 TARGET: Zone 4–5 | HR >85% in work phases

SESSION PLAN: 30s run / 15s walk, continuous for 12 minutes. Start at 11 km/h. Increase 0.5 km/h every 3 cycles. Mark a 40m zone — run toward far cone during 30s, walk toward it during 15s.

CB FOCUS: During work phases, stay in your defensive body position — upright, arms available. Do not jog in a relaxed position. Defend your space even during conditioning.

WHY: The 30-15 protocol is the highest-evidence football conditioning method. For CBs, it builds the lactate tolerance needed for repeated high-intensity defending.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('CB Speed-Endurance — 300m Shuttle Runs', '3', '300m shuttle', '3:00 rest',
      `🎯 TARGET: Zone 4–5 | HR 175–188 bpm during work, near-full recovery

SESSION PLAN: Place cones 50m apart. Sprint 50m, turn, sprint back = 100m. 3 lengths = 300m total. Full effort throughout. 3:00 walk rest. 3 reps.

CB FOCUS: On each 50m leg, maintain upright sprint mechanics — not a hunched fatigue jog. If mechanics break down before 300m is done, you've gone too hard. Calibrate on rep 1.

WHY: 300m efforts at high intensity build the lactate tolerance and speed-endurance that sustains CB sprint quality deep into matches.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('CB Speed-Endurance — 5 × 40m Hard Sprint Repeats', '5', '40m', '20s rest',
      `🎯 TARGET: Zone 5 | Maximum effort, very short recovery — lactate accumulation

SESSION PLAN: Sprint 40m at MAXIMUM effort. 20s walk rest. 5 reps. HR will not recover fully. That is the point. Every sprint must still be genuine maximum effort.

CB FOCUS: Rep 4 and 5 simulating a CB having to sprint in the 80th minute after 80 minutes of hard work. Train that specific resilience.

WHY: Very short rest at maximum distance builds the anaerobic capacity CBs need when the game is on the line in the final 10 minutes.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'CB CNS Sharp — Short Sprint Repeats',
      '6', '10–15m', '45s rest',
      `🎯 TARGET: Zone 5 max sprint | 100% effort every rep, near-full recovery

SESSION PLAN:
Use a 10m and 15m cone alternating (odd reps 10m, even reps 15m). 45s walk rest.

Every rep is 100% — first-step explosiveness, upright mechanics, max velocity intent.

Start each sprint from a different stance: set 1 from a stationary defensive position, set 2 from a jogging approach, set 3 from a back-pedal-and-turn.

CB FOCUS: The 10m sprints simulate a CB attacking the ball on a corner. The 15m sprints simulate a recovery run after being caught on the wrong side. Different sprint patterns, same maximal intent.

WHY: Pre-match week activation — maintain sprint quality, zero accumulated fatigue. 6 reps max. Leave feeling sharp, not tired.`,
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ex('CB CNS Sharp — Falling Start Sprint Activation', '5', '15m', '2:00 rest',
      `🎯 TARGET: Zone 5 | Maximum first-step output, full recovery

SESSION PLAN: Lean forward until gravity forces your first step — then sprint 15m at 100%. 2:00 full recovery. 5 reps. 3 forward lean, 2 lateral lean (simulate wrong-footed start).

CB FOCUS: The lateral lean simulates being caught slightly off-balance and having to recover. Explosive hip rotation on the first step is the key.

WHY: Falling starts prime the nervous system for explosive first-step acceleration with full recovery between reps — zero fatigue accumulation.`,
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ex('CB CNS Sharp — Back-Pedal + Sprint Activation', '4', '10m back + 15m forward', '2:30 rest',
      `🎯 TARGET: Zone 5 | Max effort on the sprint phase, full set recovery

SESSION PLAN: Back-pedal 10m at moderate pace, plant explosively, sprint 15m forward at 100%. 2:30 full rest. 4 reps.

CB FOCUS: The quality of the plant step determines the sprint. Drive the hips forward aggressively — do not let the plant-and-turn become a slow pivot.

WHY: This exact movement pattern is the CB's primary explosive action in a match. Neural priming in match week using the specific movement keeps you sharp on Saturday.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('CB CNS Sharp — Reactive Sprint Pairs', '3', '4 × 10m (reaction start)', '2:30 rest',
      `🎯 TARGET: Zone 5 | Maximum reaction speed, full set recovery

SESSION PLAN: 4 × 10m sprints per set, started from a REACTION CUE (visual — partner drops hand, you go). 15s between reps within set. 2:30 full rest between 3 sets.

CB FOCUS: React — do not anticipate. If you go before the cue, reset and redo. The reaction itself is part of the stimulus. React fast, drive hard for the full 10m.

WHY: Match-week CNS activation through reactive sprints — the brain-to-body communication that makes tackles and interceptions faster.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },

  FB: {
    Foundation: [ex(
      'FB Aerobic Base — Overlapping Run Tempo Circuit',
      '6', '40m', '25s rest',
      `🎯 TARGET: Zone 2–3 aerobic base | HR 135–160 bpm (68–80% max HR)

SESSION PLAN:
Place cones at 0m and 40m. This simulates a full-back overlap — from penalty box to the byline.

Sprint 40m at 78–82% effort (not a max sprint — a strong, controlled drive). Walk back 40m in ~25s. Repeat 6 times.

You should feel comfortably hard — breathing is elevated, not gasping. By rep 6, HR will be in Zone 3. That's the target.

FB FOCUS: On each sprint, hold your sprint line like you're overlapping a winger. Swing your arms across your body in the last 10m — mimic a cross action. The run-to-cross transition is your match movement.

WHY: Full-backs average 12–14 km per match with frequent 40–60m overlap runs. This builds the aerobic base that sustains your energy for the full 90 minutes.`,
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('FB Aerobic Base — 800m Tempo Reps', '3', '800m', '3:00 rest',
      `🎯 TARGET: Zone 2–3 | HR 140–158 bpm, sustained for the full 800m

SESSION PLAN: Run 800m at an honest aerobic pace — 2 laps of a standard track, or 8 pitch widths. Target 3:30–4:00 per 800m. HR must stay below 160. Even pace every lap. 3:00 walk rest between reps.

FB FOCUS: Hold your sprint running posture even at this pace — tall, relaxed arms, driving knees. Do not slouch at tempo pace. This is the form you'll use in the 75th minute.

WHY: 800m reps build the aerobic capacity that keeps your overlap runs powerful and controlled into the second half.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('FB Aerobic Base — 20min Aerobic Fartlek', '1', '20 min continuous', '',
      `🎯 TARGET: Zone 2–3 | Average HR 145–155 bpm over the session

SESSION PLAN: 20 minutes continuous running with variation: 2 min easy jog → 1 min strong run (80% effort) → repeat. Do not stop. The fartlek means "speed play" — control your own transitions but keep them sharp.

FB FOCUS: On every "strong run" segment, move like you're making an overlapping run — purposeful, direct sprint line. Not a shuffle. Each hard segment is a game-specific overlap.

WHY: Fartlek training mimics the variable intensity of a real match — continuous movement with periodic surges. Ideal full-back conditioning.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('FB Aerobic Base — Sprint + Lateral + Sprint Circuit', '5', '20m sprint + 20m shuffle + 20m sprint', '40s rest',
      `🎯 TARGET: Zone 3 | HR 150–165 bpm

SESSION PLAN: Sprint 20m, lateral shuffle 20m, sprint 20m = 1 rep. Walk back in 40s. 5 reps. Sprint at 82% effort, shuffle as fast as possible.

FB FOCUS: This mimics an FB's match movement — sprint to get forward, shuffle across the defensive line, then sprint to close down. The transitions between movement types must be explosive.

WHY: Position-specific aerobic conditioning that builds the multi-directional endurance FB requires.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ],

    Build: [ex(
      'FB Aerobic Threshold — 400m Tempo Runs',
      '4', '400m', '90s rest',
      `🎯 TARGET: Zone 3 aerobic threshold | HR 155–170 bpm (78–85% max HR), held for the full 400m

SESSION PLAN:
Use a 400m track or measure 400m on a pitch (approx 4 widths of a standard pitch).

Run 400m at a controlled, consistent pace — NOT a sprint. Aim for 80–85 seconds per 400m (roughly 5:30–6:00 per km pace). HR should climb to 155–170 bpm and STAY there for the full rep.

90s walk rest between reps. Don't sprint the last 100m of any rep — even pace is the goal.

FB FOCUS: Imagine reps 1–2 as your overlapping runs in the first half. Reps 3–4 as the same runs in the second half when you're fatigued. This is the conditioning that keeps your crosses accurate at minute 80.

WHY: 400m at threshold pace is the gold standard for football endurance. It builds aerobic power at the exact intensity you need for repeat overlapping runs.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('FB Aerobic Threshold — 200m Repeats', '6', '200m', '60s rest',
      `🎯 TARGET: Zone 3–4 | HR 160–175 bpm per rep, 60s rest

SESSION PLAN: Run 200m at a hard controlled pace — not a sprint, but faster than tempo. Target ~42–48s per 200m. 60s walk rest. 6 reps. HR should reach 165–175 bpm by the end of each rep.

FB FOCUS: On reps 4–6, imagine you are closing down a winger who has just received the ball. That urgency turns a fitness drill into a game simulation.

WHY: 200m at threshold intensity builds the aerobic power that allows FBs to maintain overlap run quality over a full match.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('FB Aerobic Threshold — 2 × 1200m Tempo Reps', '2', '1200m', '2:00 rest',
      `🎯 TARGET: Zone 3 | HR 155–168 bpm, sustained throughout

SESSION PLAN: Run 1200m at a steady threshold pace — 3 laps of a track, or 12 pitch widths. Even pace throughout. 2:00 walk rest. 2 reps.

FB FOCUS: The 1200m rep represents roughly 3–4 consecutive overlapping sequences in a match. Own this distance. By rep 2, your form should be the same as rep 1.

WHY: Longer threshold reps develop the aerobic capacity and mental resilience that sustain FB energy output across a full game.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('FB Aerobic Threshold — 4×4 Interval Run', '4', '4 min at 83% max HR', '3:00 rest',
      `🎯 TARGET: Zone 4 | HR 168–178 bpm, sustained for full 4 minutes

SESSION PLAN: 4 × 4 minutes at 83% max HR. 3:00 walk rest. During each 4-min block: 2:30 straight run, then 30s lateral left + 30s lateral right. Match FB movement pattern.

FB FOCUS: The lateral shuffles in each block represent your defensive shuffling — train the aerobic system to sustain that movement, not just straight running.

WHY: The 4×4 protocol is the most evidence-based VO2max training method. For FBs, integrating lateral movement makes it position-specific.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ],

    'Strength & Power': [ex(
      'FB RSA Peak — Shuttle Sprint Repeats',
      '8', '40m', '20s rest',
      `🎯 TARGET: Zone 4–5 repeated sprint | HR 175–190 bpm, very short incomplete recovery

SESSION PLAN:
Mark 40m. Sprint 40m at 88–92% effort. Walk back 40m in ~20s (your rest). Immediately sprint again. 8 total reps.

Expected: HR will climb to 175–185 bpm by rep 3 and stay there. This is the goal. You are training your ability to work at high HR without losing sprint quality.

Split your 8 reps: reps 1–4 sprint to the far cone, reps 5–8 alternate sprinting AND backpedalling 10m before turning (mimicking defensive recovery before the next overlap).

FB FOCUS: On rep 8, you should still be producing a genuine sprint, not a jog. If your pace drops more than 15% from rep 1, extend rest to 30s for the final reps.

WHY: Full-backs must overlap repeatedly in both halves. This directly trains the RSA quality that distinguishes elite full-backs.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('FB RSA Peak — 10 × 20m Sprint Intervals', '10', '20m', '15s rest',
      `🎯 TARGET: Zone 5 | Maximum effort, very short recovery — lactate overload

SESSION PLAN: Sprint 20m at MAXIMUM effort. 15s walk rest. 10 reps. HR will not drop between reps — that is deliberate. Every sprint must still be a genuine max effort attempt.

FB FOCUS: Reps 8–10 simulate the 80th-minute overlap run when you are already fatigued. Train the quality degradation — fight to maintain form even when the lactic burn is intense.

WHY: 20m with 15s rest trains the extreme end of FB repeated sprint ability — the sprint quality that matters most late in games.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('FB RSA Peak — 60m Overlap Sprint Reps', '6', '60m', '30s rest',
      `🎯 TARGET: Zone 4–5 | 90% effort per rep, short recovery

SESSION PLAN: Sprint 60m at 90% effort — this is a full overlap run distance. Walk back in 30s. 6 reps. Target consistent pace across all 6 reps.

FB FOCUS: Every rep is a full overlap run — from your defensive position to the byline. Arms pumping, drive through to the full 60m. Don't decelerate before the cone.

WHY: Training at actual overlap distance and intensity builds specific RSA for the FB's primary weapon — the late run.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('FB RSA Peak — 400m Anaerobic Repeats', '3', '400m', '3:00 rest',
      `🎯 TARGET: Zone 5 anaerobic capacity | HR 180–190 bpm throughout, near-full recovery

SESSION PLAN: Run 400m as fast as sustainably possible — NOT a sprint, but a hard sustained effort. Target 75–80s per 400m. 3:00 full walk rest. 3 reps.

FB FOCUS: Rep 3 should feel brutal. That is the late-game overlap when the result is in the balance. Train the capacity to keep going when every fibre says stop.

WHY: 400m anaerobic repeats build the maximum aerobic-anaerobic capacity that separates high-performance FBs from average ones.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'FB Pre-Match Sharpener — 4×4 Minute Intervals',
      '4', '4 min at 85% max HR', '3:00 rest',
      `🎯 TARGET: Zone 4 VO2max stimulus | HR 170–180 bpm sustained for full 4 minutes

SESSION PLAN:
4 × 4-minute continuous runs at 85% max HR. 3 minutes active walk rest between intervals.

Pace guide: ~4:00–4:30 per km. After the first 60s, your HR should be climbing toward 170 bpm. Hold that effort for the full 4 minutes.

During the 3-minute rest: walk, do not sit. Keep HR above 120 bpm so you can re-enter the work phase quickly.

Structure each 4-min interval as: 2 min straight run → 30s lateral shuffle left → 30s lateral shuffle right → 1 min straight run. This matches FB movement patterns in possession.

WHY: The 4×4 interval is the most evidence-based protocol for increasing VO2max in footballers. 4 sessions of this protocol have been shown to improve match running distance by 100–150m.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('FB Pre-Match Sharpener — 3 × 6min at 80% HR', '3', '6 min at 80% max HR', '3:00 rest',
      `🎯 TARGET: Zone 4 | HR 165–175 bpm sustained, near-full recovery

SESSION PLAN: 3 × 6 minutes at 80% max HR. 3:00 walk rest. Slightly less intense than 4×4 — good option when legs feel slightly heavy. HR 165–175 throughout.

FB FOCUS: During each 6-min block, vary direction every 2 minutes: 2 min forward, 2 min lateral, 2 min forward. Always purposeful movement.

WHY: Slightly lower intensity than 4×4 with same aerobic stimulus — use when readiness is moderate but you still need to maintain conditioning.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('FB Pre-Match Sharpener — 5 × 2min High Intensity', '5', '2 min at 88% max HR', '90s rest',
      `🎯 TARGET: Zone 4–5 | HR >175 bpm in work phases, 90s incomplete rest

SESSION PLAN: 5 × 2 minutes at 88% max HR. 90s walk rest. Short, high-quality work bouts. Each 2-min block should have HR at 175+ by the 60s mark.

FB FOCUS: 2-min work intervals match the average bout duration of a FB's sustained high-intensity running phase in a match. Train the exact duration.

WHY: Short high-intensity intervals in match week maintain peak aerobic capacity without creating fatigue that carries into the game.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('FB Pre-Match Sharpener — Sprint + Overlap Activation', '5', '40m sprint + 15m jog', '90s rest',
      `🎯 TARGET: Zone 4–5 | 90% sprint effort, aerobic recovery jog

SESSION PLAN: Sprint 40m at 90% effort, immediately jog 15m more (do not stop), then walk back. 90s rest. 5 reps.

FB FOCUS: The 15m jog after the sprint represents the crossed ball — you've made your run, now reposition. Do not just stop — transition immediately as you would in a match.

WHY: Sprint + immediate transition trains the mental switch that FBs need to make — from explosive sprint to immediate positional awareness.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ],
  },

  CM: {
    Foundation: [ex(
      'CM Aerobic Base — Tempo Run 1000m Reps',
      '3', '1000m', '2:00 rest',
      `🎯 TARGET: Zone 2 aerobic base | HR 135–155 bpm (68–78% max HR) — conversational pace

SESSION PLAN:
3 × 1000m at an honest aerobic pace. On a 400m track: 2.5 laps. On a pitch: approx 10 widths.

Target pace: 5:00–5:30 per km (1000m in 5–5:30 minutes). You must be able to speak 5–6 words without gasping. If you can't, you're too fast — slow down.

HR monitor guide: HR should NOT exceed 155 bpm. If it does, reduce pace. This is an aerobic session, not a tempo effort.

2:00 walk rest between reps. During rest, shake out your legs, breathe fully, check HR drops below 130 before starting rep 2 and 3.

CM FOCUS: Midfielders cover 11–13 km per match with the highest aerobic demands on the pitch. This pace represents your 60-minute running average in a game. Own it.

WHY: Zone 2 training builds mitochondrial density and fat oxidation — the foundation of your 90-minute engine. Without this base, your high-intensity capacity has no platform.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('CM Aerobic Base — 20min Continuous Zone 2 Run', '1', '20 min at 68–75% max HR', '',
      `🎯 TARGET: Zone 2 | HR 135–150 bpm throughout — must be sustainable

SESSION PLAN: Run continuously for 20 minutes at a truly easy aerobic pace. Use a flat surface — track, road, or grass. HR 135–150. Do not exceed 150 bpm. If you do, slow down.

CM FOCUS: Set a route that challenges you to stay focused for 20 minutes. Midfielders cover the most ground in a match — this is your foundation session. No phones. Just run.

WHY: 20 minutes of uninterrupted Zone 2 builds mitochondrial density — the energy factory that powers your aerobic engine for 90 minutes.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('CM Aerobic Base — Cardiac Output Circuit', '3', '5 min', '90s rest',
      `🎯 TARGET: Zone 2 | HR 130–150 bpm — continuous mixed modalities

SESSION PLAN: 5 minutes per round using any available equipment and movement: 1 min jog → 1 min lateral shuffle → 1 min jog → 1 min sprint at 70% → 1 min jog. Repeat 3 rounds. 90s rest.

CM FOCUS: The lateral and sprint segments are your press triggers. The jog segments are your recovery runs between actions. This is your match. HR 130–150 throughout.

WHY: Multi-modal aerobic circuits mimic the variable-intensity nature of match running while maintaining consistent Zone 2 stimulus.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('CM Aerobic Base — 1200m Tempo Reps', '3', '1200m', '90s rest',
      `🎯 TARGET: Zone 2–3 | HR 140–158 bpm — slightly faster than easy

SESSION PLAN: Run 1200m (3 laps of a track) at a moderate aerobic pace — slightly faster than the 1000m session. HR 140–158. 90s walk rest between reps. 3 reps.

CM FOCUS: The 1200m at aerobic pace represents the sustained running phase of a CM in a possession-based system. Even rhythm throughout — never surge, never drift.

WHY: Longer reps at Zone 2–3 build the aerobic capacity and fat oxidation that supports 11–13 km per match.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ],

    Build: [ex(
      'CM VO2max — 4×4 Minute Interval Run',
      '4', '4 min at 85–90% max HR', '3:00 active rest',
      `🎯 TARGET: Zone 4–5 VO2max | HR 170–185 bpm for the last 2 minutes of each interval

SESSION PLAN:
4 × 4-minute intervals at 85–90% max HR. 3 minutes walking rest between intervals.

Pace guide: ~3:30–4:00 per km. In each 4-min interval:
• First 60s: accelerate to working pace
• Minutes 1–3: hold the pace, HR climbs to 170–175 bpm
• Minute 4: HR should be at 175–185 bpm — this is where the adaptation happens

During rest: WALK only, do not sit. HR should drop to ~140 bpm before you start the next rep.

CM FOCUS: Design each interval as a box-to-box simulation. During rep 1: imagine you're pressing from a set piece for 4 minutes. Rep 3: think second-half fatigue — same pace, higher cost. This mental framing trains match-specific conditioning.

WHY: Research shows 4×4 intervals at >85% HRmax improve VO2max by 8–10% in footballers over 8 weeks. VO2max is the strongest predictor of distance covered per match.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('CM VO2max — 6 × 3min Intervals', '6', '3 min at 85% max HR', '90s rest',
      `🎯 TARGET: Zone 4–5 | HR 170–182 bpm in work phases, 90s incomplete rest

SESSION PLAN: 6 × 3 minutes at 85% max HR. 90s walk rest — HR will NOT drop to 140, and that is intentional. Pace: ~3:45–4:15 per km.

CM FOCUS: The 90s rest window mirrors a CM's recovery period between high-intensity pressing bouts in a match. Train to re-enter the next work bout at 80–85% even when partially recovered.

WHY: 6 × 3min with short rest builds VO2max stimulus and the capacity to perform at high HR with incomplete recovery — a defining CM quality.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('CM VO2max — Interval Pyramid', '1', '2-4-6-4-2 min intervals', '90s between',
      `🎯 TARGET: Zone 4 | HR 168–178 bpm, sustained throughout

SESSION PLAN: Run at 83% max HR throughout. 2 min on, 90s off, 4 min on, 90s off, 6 min on, 90s off, 4 min on, 90s off, 2 min on. Pace guide ~4:00–4:20 per km.

CM FOCUS: The 6-min segment in the middle is the most demanding — this is your second half when fatigue is maximum. Maintain the same pace as the first 2-min segment. Mental toughness is the target here.

WHY: Pyramid intervals build VO2max while developing the ability to maintain pace as fatigue accumulates — exactly what CMs need in the 70th minute.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('CM VO2max — 2 × 8min Sustained Effort', '2', '8 min at 80% max HR', '3:00 rest',
      `🎯 TARGET: Zone 4 | HR 165–175 bpm sustained for 8 continuous minutes

SESSION PLAN: 2 × 8 minutes at a sustained hard effort. 3:00 walk rest. Pace: ~4:15–4:45 per km. HR should reach 165 bpm by the 2-minute mark and stay there.

CM FOCUS: 8 continuous minutes at threshold is a first-half period of sustained CM work. During the 3-minute rest, analyse your pacing — did you slow at minute 6? That is your weakness to target.

WHY: Sustained 8-minute efforts build the ability to maintain high aerobic output over extended periods — the CM's defining fitness quality.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ],

    'Strength & Power': [ex(
      'CM Lactate Threshold — 30-15 Intermittent Fitness Protocol',
      '1', '12 min continuous', '',
      `🎯 TARGET: Zone 4–5 | HR >85% max HR sustained through work phases, ~145 bpm in recovery

SESSION PLAN (Martin Buchheit's 30-15 IFT protocol):
Set up two cones 40m apart. The circuit alternates 30s running → 15s walking, continuously for 12 minutes.

Start at 12 km/h for the first 30s run. Every 3 cycles (1.5 min), increase speed by 0.5 km/h.

Cycle structure:
• 30s RUN at current speed (toward the far cone, turn at 40m, run back)
• 15s WALK (decelerate, walk toward the far cone — you won't reach it)
• Repeat immediately

HR guide: Work phases should push HR above 85% (170+ bpm). Walk recovery drops HR to ~145–150 bpm. You never fully recover — that's the point.

CM FOCUS: This is the closest thing to box-to-box midfield conditioning in a structured protocol. The 30s run mirrors a press or recovery run; the 15s walk mirrors a reset before the next defensive action.

WHY: The 30-15 IFT is the most football-specific aerobic conditioning protocol in sports science. It matches the actual work-to-rest ratio of a central midfielder in a high-pressing system.`,
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    ex('CM Lactate Threshold — 10 × 45s Sprint Intervals', '10', '45s on / 15s rest', '2:00 after round of 5',
      `🎯 TARGET: Zone 4–5 | Maximum sustainable effort for 45s, 15s recovery

SESSION PLAN: 45s sprint at 90% effort, 15s walk rest. Do 5 reps, then 2:00 full rest. Then 5 more reps. Total: 10 reps. Pace must be genuine — not a jog.

CM FOCUS: 45s bouts represent the typical CM press-trigger sprint sequence. The fatigue accumulated across 5 reps mirrors late-game conditioning demands. Maintain pace on rep 10 as on rep 1.

WHY: Short high-intensity intervals with minimal recovery specifically target the anaerobic-aerobic overlap zone that CMs occupy most during matches.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ex('CM Lactate Threshold — 500m Race Pace Reps', '3', '500m', '2:00 rest',
      `🎯 TARGET: Zone 4–5 | 90% of best 500m pace, HR 175–188

SESSION PLAN: Run 500m at 90% of your best 500m pace (roughly 1:45–2:05). 2:00 walk rest. 3 reps. HR should reach 175+ by the end of each rep.

CM FOCUS: On rep 3, your pace must match rep 1. If it drops by more than 5%, extend rest on the next session. This is the standard — match that consistency.

WHY: 500m reps at high intensity build the lactate tolerance that CMs need to sustain sprint quality from minute 1 to minute 90.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('CM Lactate Threshold — 3 × 3min Very Hard Intervals', '3', '3 min very hard', '3:00 rest',
      `🎯 TARGET: Zone 5 | HR 178–190 bpm, near-full recovery between reps

SESSION PLAN: 3 × 3 minutes at near-maximum aerobic effort (95% max HR target). 3:00 walk rest. Only 3 reps — quality beats volume here. Pace: as fast as you can sustain for the full 3 minutes.

CM FOCUS: This is brutal. Rep 3 should feel like the last 3 minutes of a high-press system in extra time. Train the psychological capacity to keep sprinting when your lungs are burning.

WHY: Very high intensity with near-full recovery trains the maximum aerobic power that allows CMs to sustain the highest quality pressing throughout matches.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'CM Match-Day Prep — Box-to-Box Sprint Simulation',
      '6', '20m', '30s rest',
      `🎯 TARGET: Zone 5 | 100% effort each rep, near-full recovery — CNS priming not conditioning

SESSION PLAN:
Mark 20m. Stand at one end.

Sprint 20m at 100% effort. Decelerate hard at the cone. 30s walk rest. Sprint back. That's 2 reps. Total: 6 reps (3 each direction).

Effort: every rep is 100%. HR will peak at 180–190+ bpm during reps, then drop fully during rest. This is maximal CNS activation, not conditioning.

If your last rep isn't as fast as rep 1 within 5%, you're not recovering enough — extend rest to 45s.

CM FOCUS: Before each sprint, tap the cone with your hand as if playing a pass. Sprint out of a passing action — the most common way CMs enter sprinting actions in matches.

WHY: Low-volume, high-quality. This is match-week sharpening. 6 reps at full intent prime your nervous system without creating fatigue that carries into the game.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ex('CM Match-Day Prep — 10m Short Sprint Activation', '6', '10m', '45s rest',
      `🎯 TARGET: Zone 5 | Maximum first-step output, full recovery

SESSION PLAN: Sprint 10m at 100% from different starting positions. 45s full rest. 6 reps: 2 from standing, 2 from jogging approach, 2 from a lateral start. Every rep 100%.

CM FOCUS: From jogging approach — receive a pass (mimic touch), then explode into the sprint. This is your most common pressing trigger. React fast, drive hard for the full 10m.

WHY: Match-week CNS priming. 6 × 10m at full intent is the minimum dose to keep your nervous system sharp without generating fatigue.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ex('CM Match-Day Prep — Press Trigger Intervals', '4', '4 × (30s on / 30s off)', '2:30 rest',
      `🎯 TARGET: Zone 5 | Maximum output during work, full set recovery

SESSION PLAN: 4 × (30s sprint / 30s stand) = 1 set. 2:30 full rest. 4 sets total. 30s sprint at 100% — not 85%, not 90%. The 30s off is complete rest.

CM FOCUS: 30s sprint is your press trigger burst — you win the ball at the end or you've closed enough space to force an error. Own each 30s completely.

WHY: Press trigger intervals mimic the exact work-rest pattern of a high-press system. CNS primed, patterns reinforced, zero fatigue accumulation with full set recovery.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ex('CM Match-Day Prep — Sprint Cluster Protocol', '3', '3 × 10m (15s rest)', '3:00 rest',
      `🎯 TARGET: Zone 5 | Maximum output, full set recovery — neural priming

SESSION PLAN: 3 × 10m sprints with 15s rest between = 1 cluster. 3:00 full rest. 3 clusters total. Every sprint is 100%. The 15s rest within clusters does not allow full recovery — this matches your match demand sequence.

CM FOCUS: This is the CM's match pattern — 3 rapid high-intensity actions (press, recover, press) followed by a longer rest. Train the pattern, not just the sprints.

WHY: Cluster training matches actual CM activity patterns in matches and provides the neural priming needed for match-day performance.`,
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    ],
  },

  W: {
    Foundation: [ex(
      'Winger RSA Base — Repeated 40m Sprints',
      '6', '40m', '25s rest',
      `🎯 TARGET: Zone 3–4 | HR 155–175 bpm (78–88% max HR), 25s incomplete recovery

SESSION PLAN:
Place cones at 0m and 40m on the touchline or sideline. This distance simulates a winger's channel run.

Sprint 40m at 82–85% effort. Walk back 40m in ~25s. Immediately sprint again. 6 total reps.

Monitor your effort: reps 1–3 will feel easy. Reps 4–6 are where the conditioning stimulus is. Don't go all-out on rep 1 — you'll crater by rep 5.

WINGER FOCUS: On reps 1, 3, 5 (odd): sprint down a straight channel — left foot dominant if you're a right-footed left winger, or vice versa. On reps 2, 4, 6 (even): curve your sprint from the centre toward the touchline, as if receiving a ball in behind the full-back.

WHY: Wingers perform 25–35 high-speed runs per match, often with only 30–45s recovery. Repeated sprint ability (RSA) is your most critical physical quality.`,
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('Winger RSA Base — 60m Channel Sprint Reps', '5', '60m', '35s rest',
      `🎯 TARGET: Zone 3–4 | HR 158–175 bpm, short incomplete recovery

SESSION PLAN: Sprint 60m at 83% effort. Walk back in 35s. 5 reps. 60m is the full winger channel — from the defensive third to the byline.

WINGER FOCUS: On even reps (2, 4), curve your run from centre to touchline — inside-to-outside channel run. This is your most dangerous run. Train it at fatigue.

WHY: 60m reps at the actual winger channel distance build RSA at the distance that matters for your position.`,
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('Winger RSA Base — Acceleration Ladder', '2', '10m + 20m + 30m + 20m + 10m', '2:30 rest',
      `🎯 TARGET: Zone 3–4 | HR 155–170 bpm per round

SESSION PLAN: One round: sprint 10m, rest 20s, sprint 20m, rest 25s, sprint 30m, rest 30s, sprint 20m, rest 25s, sprint 10m. 2:30 full rest between rounds. 2 rounds total.

WINGER FOCUS: The 30m sprint in the middle is your channel run — maximum effort. The 10m sprints are your explosive touches — first-step bursts. Different distances, same 100% intent.

WHY: Varied sprint distances in a single session train the full spectrum of winger speed — first-step, channel run, and short burst.`,
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    ex('Winger RSA Base — 5-10-5 Agility + Sprint Reps', '5', '5-10-5 + 30m sprint', '45s rest',
      `🎯 TARGET: Zone 3–4 | HR 160–175 bpm, 45s rest

SESSION PLAN: 5-10-5 agility shuttle (5m right, 10m left, 5m back to centre), immediately sprint 30m from the centre cone. 45s rest. 5 reps.

WINGER FOCUS: The 5-10-5 simulates you checking inside and accelerating back outside — classic winger movement. The 30m sprint after is your channel run. Both at 100%.

WHY: Combining change-of-direction with a straight sprint trains the winger's complete physical profile in every rep.`,
      { methodType: 'reactive', intensityIntent: 'submaximal' }),
    ],

    Build: [ex(
      'Winger RSA Development — Progressive 40m Sprint Repeats',
      '8', '40m', '20s rest',
      `🎯 TARGET: Zone 4–5 | HR 175–190 bpm, very short recovery — building lactate tolerance

SESSION PLAN:
Mark 40m. Sprint 40m at 88–92% effort. Walk back in ~20s. Sprint again. 8 total reps.

Pacing: Reps 1–3: 88% effort. Reps 4–6: 90% effort. Reps 7–8: MAX effort. Finish fast.

Expected HR: will reach 175–180 bpm by rep 3 and stay there. If HR exceeds 188 bpm at rest, extend recovery to 30s.

WINGER FOCUS: Every 2nd rep, execute a step-over body feint at the 20m point — fake inside, burst outside for the final 20m. This simulates beating a full-back. The feint doesn't have to be perfect; the explosive acceleration AFTER it is the goal.

WHY: This session directly trains the anaerobic capacity that powers your repeated dribbling and sprinting bursts. Elite wingers recover to within 90% of their max sprint in under 20 seconds.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Winger RSA Development — 10 × 20m with Cut', '10', '20m + 45° cut', '20s rest',
      `🎯 TARGET: Zone 4–5 | 90% effort every rep, very short recovery

SESSION PLAN: Sprint 20m, execute a 45° cut at the cone (plant outside foot, drive off it), sprint 10m in the new direction. Walk back in 20s. 10 reps, alternating cut direction.

WINGER FOCUS: The cut simulates your acceleration past a defender. The plant foot must be aggressive — drive the hips into the new direction, don't drift. Rep quality on 8–10 is what separates you.

WHY: 20m sprint + cut trains the RSA while reinforcing the change-of-direction mechanics that are central to the winger position.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Winger RSA Development — 50m Progressive Reps', '6', '50m', '25s rest',
      `🎯 TARGET: Zone 4–5 | 90% effort, 25s very short recovery

SESSION PLAN: Sprint 50m at 90% effort. Walk back in 25s. 6 reps. Focus on maintaining sprint quality into the second half of each 50m.

WINGER FOCUS: The back half of each 50m rep is when your mechanics will break down first. Drive your knees, pump your arms — do not shorten your stride in fatigue.

WHY: 50m with short rest builds the lactate tolerance and speed maintenance that keeps your channel runs dangerous in the 80th minute.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Winger RSA Development — Dribble Burst Sprint Circuit', '8', '5m sprint + cut + 25m sprint', '25s rest',
      `🎯 TARGET: Zone 4–5 | Maximum explosive output per rep

SESSION PLAN: Sprint 5m to a cone, execute a sharp direction change (simulate receiving a pass and cutting), then sprint 25m at 100%. Walk back in 25s. 8 reps.

WINGER FOCUS: The 5m to the cut is your reception run — quick feet, eyes up. The 25m after the cut is your strike run — 100% acceleration from an unstable position. This is your most dangerous pattern.

WHY: Simulates the winger's most common goal-scoring movement — receive, cut, accelerate. Train it at lactate stress.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ],

    'Strength & Power': [ex(
      'Winger Maximum Velocity — Flying 30m Repeats',
      '6', '30m flying zone', '60s rest',
      `🎯 TARGET: Zone 5 maximum velocity | 95–100% top speed, near-full recovery (speed quality first)

SESSION PLAN:
Set up a 20m run-up and a 30m flying zone (50m total). Start behind the 0m cone.

Reps 1–6: Accelerate over 20m building to top speed, then maintain MAX velocity through the 30m zone. Decelerate safely beyond.

60s full rest between reps — this is about max velocity, not conditioning. Walk, shake out, breathe.

The 30m flying zone should be timed if possible (aim for sub-3.0s for the 30m). Each rep should feel like you're hitting a wall of speed.

WINGER FOCUS: In the flying zone, focus on maximum stride length — drive your arms, stay tall, push the ground away behind you (not down). You are a winger at full pace chasing a through-ball. Nothing in football is faster than this moment.

WHY: Flying sprints train maximum velocity — the top-end speed that separates elite wingers. Most RSA training doesn't reach true max speed; this does.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Winger Maximum Velocity — Flying 20m Repeats', '8', '20m flying zone', '45s rest',
      `🎯 TARGET: Zone 5 | Max velocity, 45s near-full recovery

SESSION PLAN: 15m run-up, then 20m flying zone at maximum speed. 45s walk rest. 8 reps. Slightly shorter flying zone than 30m — higher rep count.

WINGER FOCUS: The shorter zone means your peak velocity window is more compressed. You must reach max speed faster. This trains the acceleration-to-max-velocity transition that you use on every channel run.

WHY: Flying 20m with more reps trains max velocity with higher volume — increasing neural adaptation to top-end speed.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Winger Maximum Velocity — Sprint Volume Sets', '3', '3 × 30m (15s between reps)', '3:30 rest',
      `🎯 TARGET: Zone 5 | Max velocity, full set recovery

SESSION PLAN: 3 × 30m sprints with 15s rest between reps = 1 set. 3:30 full rest between 3 sets. Reps within a set: 100% intent even though the 15s rest won't allow full recovery.

WINGER FOCUS: Set 1 is quality. Set 2 is who you are. Set 3 is who you want to be. Max speed on every rep of every set.

WHY: Sprint volume sets build maximum velocity endurance — the ability to reach and maintain top speed multiple times per match.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Winger Maximum Velocity — Hill Sprint Simulation', '6', '30m hard resistance run', '90s rest',
      `🎯 TARGET: Zone 5 | Maximum horizontal force output, near-full recovery

SESSION PLAN: Sprint 30m at 100% effort into a slight headwind or uphill gradient (5°). Walk back in 90s. 6 reps. If no slope available, use a resistance band anchored behind you (light load — this is about speed, not strength).

WINGER FOCUS: Resist the slope/band with aggressive forward lean and powerful arm drive. When you sprint flat next time, you will be faster. Overspeed and resistance are the winger's training edge.

WHY: Resistance sprints increase stride power and max velocity capacity — direct transfer to flat-pitch top speed.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'Winger CNS Activation — Sprint Cluster Protocol',
      '4', '3 × 20m (15s between reps)', '3:00 between sets',
      `🎯 TARGET: Zone 5 | MAX effort every rep, full set recovery — neural priming

SESSION PLAN:
3 sprints of 20m with only 15s rest between sprints = 1 cluster. 4 clusters total, 3:00 full walk rest between clusters.

Each sprint: 100% intent. 15s recovery is not enough for full ATP replenishment — you will feel the burn on rep 3 of each cluster. That is normal and intended.

3:00 between clusters is FULL recovery. Do not rush this rest. Walk, breathe, refocus.

WINGER FOCUS: Cluster 1: start from standing. Cluster 2: start from a receiving-a-pass body position (sideways on). Cluster 3: start from a turning-on-the-ball moment (back to direction of sprint → react and go). Cluster 4: full-speed from a standing start.

WHY: Sprint clusters mimic a winger's actual match pattern — 3 high-intensity actions in rapid succession (press, recover, attack) before a longer recovery phase. This is your match rhythm.`,
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ex('Winger CNS Activation — 6 × 20m Pure Speed', '6', '20m', '2:00 rest',
      `🎯 TARGET: Zone 5 | 100% effort, full recovery — express peak speed

SESSION PLAN: Sprint 20m at 100%. 2:00 full walk rest. 6 reps. This is your top speed expressed. Do not rush the rest.

WINGER FOCUS: Every rep — feel yourself at full speed. Tall posture, pawing the ground back, arms fast and relaxed. This is the body you've built. Express it.

WHY: Pure speed sessions with full recovery express maximum neural output without fatigue accumulation. 6 reps is the optimal dose before a match.`,
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ex('Winger CNS Activation — Lateral Start Sprints', '5', '10m', '60s rest',
      `🎯 TARGET: Zone 5 | Maximum first-step from unstable position, full recovery

SESSION PLAN: Start facing sideways, react to a visual cue, rotate and sprint 10m at 100%. 60s full rest. 5 reps alternating starting direction. Do not anticipate — wait for the cue.

WINGER FOCUS: This is your most common match starting position — receiving a ball sideways on and accelerating past the full-back. The hip rotation on the first step is the explosive moment.

WHY: Lateral-start sprints prime the specific neuromuscular pattern wingers use to beat defenders — maximum transfer to match day.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Winger CNS Activation — Channel Sprint Simulation', '3', '40m', '3:00 rest',
      `🎯 TARGET: Zone 5 | 95% effort, full 3-minute recovery

SESSION PLAN: Sprint 40m at 95% effort — this is your channel run. 3:00 full walk rest. 3 reps. Only 3. Quality over quantity in match week.

WINGER FOCUS: Rep 1 is a warm-up sprint. Rep 2 is your best. Rep 3 should match rep 2. If it doesn't, you're not recovering enough. This is not conditioning — it is priming.

WHY: 3 quality channel runs with full recovery keep your sprint mechanics sharp and your nervous system primed without generating fatigue.`,
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
  },

  ST: {
    Foundation: [ex(
      'Striker Aerobic Base — Sprint-Jog Recovery Circuit',
      '6', '30m sprint + 40m jog recovery', 'Continuous — no full stop',
      `🎯 TARGET: Zone 2–3 | HR 140–160 bpm sustained throughout the circuit

SESSION PLAN:
Mark 30m and 40m in a line (70m total from start to end). No full stops — this is continuous.

Sprint 30m at 80% effort → immediately jog 40m recovery → turn at 40m cone → sprint 30m back → jog 40m recovery. That's 1 full round. Complete 6 rounds continuously.

Pace guide: Your 30m sprints should feel strong but not all-out. Your 40m jogs should feel easy — HR will only drop a few beats. The goal is sustained output, not explosive peaks.

HR target: 140–162 bpm throughout. If HR drops below 135 during the jog, increase sprint pace. If HR exceeds 170, slow the jog.

STRIKER FOCUS: On the sprint sections, explode from a stationary position — no running start. Mimic breaking the defensive line from an attacking position. On odd rounds, start with your body facing away from the sprint direction, turn and go.

WHY: Strikers average 2.5–3 km of high-speed running per match with many explosive short sprints. This builds the aerobic platform that sustains your sprint quality deep into games.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('Striker Aerobic Base — 800m Zone 2 Reps', '3', '800m', '3:00 rest',
      `🎯 TARGET: Zone 2–3 | HR 140–155 bpm

SESSION PLAN: Run 800m at a comfortable aerobic pace. HR 140–155. 3:00 rest between reps. 3 reps. Even pace throughout — no surging.

STRIKER FOCUS: Think of each 800m as two full-pitch lengths of sustained running. The aerobic base you build here is what keeps you dangerous in the 85th minute when others are walking.

WHY: Zone 2 running builds the mitochondrial density that supports explosive bursts throughout a full match.`,
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('Striker Aerobic Base — Aerobic Fartlek Circuit', '1', '20 min continuous', '',
      `🎯 TARGET: Zone 2–3 | HR 140–158 bpm average

SESSION PLAN: 20 min continuous: 2 min easy jog → 1 min strong run (75% effort) → repeat. Mix directions — forward, lateral, back-pedal segments. HR average 140–158.

STRIKER FOCUS: On each "strong run" segment, simulate making a run off the ball — purposeful, explosive start then controlled arrival. Do not coast.

WHY: Variable-intensity aerobic training mimics match running patterns while building the aerobic engine.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('Striker Aerobic Base — Short Sprint + Recovery Jog Circuit', '4', '5 × (10m sprint + 30s jog)', '2:00 rest',
      `🎯 TARGET: Zone 2–3 | HR 145–160 bpm

SESSION PLAN: 5 × 10m sprint at 80%, immediately jog 30s recovery. No full stop. 2:00 rest between sets. 4 sets total.

STRIKER FOCUS: Each 10m sprint is a run off the ball — explosive start, attack the space. The 30s jog is your recovery before the next movement. This is your 90-minute pattern.

WHY: Short sprint + jog circuits build the aerobic base using striker-specific movement patterns.`,
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ],

    Build: [ex(
      'Striker Explosive Power — 10m Burst Repeats',
      '10', '10m', '30s rest',
      `🎯 TARGET: Zone 4–5 | Maximum explosive power, partial recovery — anaerobic capacity

SESSION PLAN:
Mark 10m. Start behind the line each rep.

10 reps × 10m sprint at 100% intent. 30s walk rest between reps.

Start from a different position each rep:
• Rep 1–2: Standing start, facing sprint direction
• Rep 3–4: Back to sprint direction, react-and-go
• Rep 5–6: Standing start, slight lean and lean-touch a cone at feet first
• Rep 7–8: Walking approach 5m then explode at the start line
• Rep 9–10: Standing start — these should be fastest (you're dialled in now)

Expected HR: 175–190 bpm during reps, drops during 30s rest to ~150 bpm. HR never fully recovers — building lactate tolerance.

STRIKER FOCUS: The first 3 steps decide this sprint. Drive your knee up aggressively, push the ground behind you. This is a striker getting in behind the defensive line — the most valuable 10m in football.

WHY: 10m burst speed is the most decisive physical quality for strikers. Studies show the 80% of goals are preceded by an attacker making a short explosive sprint in the final third.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Striker Explosive Power — 5m + 10m Combo Bursts', '8', '5m cut + 10m sprint', '30s rest',
      `🎯 TARGET: Zone 4–5 | Maximum explosive output per rep

SESSION PLAN: Sprint 5m to a cone, plant and cut 90°, sprint 10m at 100% in the new direction. Walk back in 30s. 8 reps, alternating cut direction. The cut must be explosive — not a wide turn.

STRIKER FOCUS: This simulates your most dangerous movement — the near-post run where you check inside and then burst outside (or vice versa). The cut foot must drive the new direction instantly.

WHY: Explosive first-step after a change of direction is the striker quality that creates goal-scoring opportunities against organised defences.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Striker Explosive Power — 15m Sprint + Hard Stop', '8', '15m + hard brake', '25s rest',
      `🎯 TARGET: Zone 4–5 | Maximum sprint + eccentric deceleration, 25s short rest

SESSION PLAN: Sprint 15m at 100% effort, hard brake — stop within 2 steps at the cone. Walk back in 25s. 8 reps.

STRIKER FOCUS: The hard stop simulates arriving at the back post for a cross — sprint in, stop, jump. The deceleration at pace is both an injury prevention stimulus and a match skill.

WHY: Explosive acceleration + hard deceleration trains the anaerobic system while reinforcing the striker's fundamental attacking pattern.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Striker Explosive Power — Box Start + Sprint Reps', '10', '10m from varied starts', '35s rest',
      `🎯 TARGET: Zone 4–5 | First-step explosiveness, partial recovery

SESSION PLAN: Sprint 10m at 100% from one of these starts (cycle through): standing, crouching low, on one knee (jump up), lateral shuffle → forward. 35s rest. 10 reps, 2–3 of each start type.

STRIKER FOCUS: Strikers start sprints from every possible position during a match. Training explosive first-step from unstable positions trains the neuromuscular coordination for all of them.

WHY: Variable start-position sprints build comprehensive explosive first-step capacity rather than one-dimensional straight-line speed.`,
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ],

    'Strength & Power': [ex(
      'Striker Speed-Endurance — Repeated 20m Sprints',
      '8', '20m', '20s rest',
      `🎯 TARGET: Zone 5 anaerobic capacity | Maximum effort, very short recovery — lactate tolerance

SESSION PLAN:
Mark 20m. Sprint 20m at MAXIMUM effort. Turn and immediately walk back in ~18–20s. Sprint again. 8 total reps.

Each sprint must be genuine max effort. If you cannot maintain 90%+ of your rep 1 pace by rep 6, extend rest to 30s.

The burn you feel from rep 4 onward is lactic acid accumulation. Learning to sprint hard THROUGH this feeling is exactly what this session develops.

STRIKER FOCUS: Odd reps (1, 3, 5, 7): sprint toward goal, mimic arrival at the back post. Even reps (2, 4, 6, 8): sprint at 45°, mimic peeling off the last defender toward the near post. Same effort, different angle — training the explosive patterns you use in the box.

WHY: Strikers need to reach top speed and maintain sprint quality even when fatigued deep in games. Short rest, maximum speed trains both anaerobic capacity and speed-specific fatigue resistance.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Striker Speed-Endurance — 10 × 15m Maximum Effort', '10', '15m', '15s rest',
      `🎯 TARGET: Zone 5 | Maximum effort, very short 15s recovery

SESSION PLAN: Sprint 15m at 100%. 15s walk rest. 10 reps. HR will not drop — the accumulated lactate is the adaptation stimulus. Every rep must be a genuine maximum effort attempt.

STRIKER FOCUS: 15m is the most common striker sprint distance in the penalty area. Train it at maximum intensity with the exact rest-to-work ratio you experience in a game.

WHY: 10 × 15m with 15s rest is one of the most demanding sessions in this programme — but it directly builds the anaerobic capacity that separates clinical strikers.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Striker Speed-Endurance — 6 × 30m Hard Sprints', '6', '30m', '30s rest',
      `🎯 TARGET: Zone 5 | 92% effort, very short 30s recovery

SESSION PLAN: Sprint 30m at 92% effort. 30s walk rest. 6 reps. Target consistent pace — reps 5 and 6 at 92% is the measure of this session's success.

STRIKER FOCUS: On odd reps (1, 3, 5): sprint toward a crossing position — arms out, ready to finish. On even reps (2, 4, 6): sprint away from a defender — drive from the hip, do not look back.

WHY: 30m sprints train the speed-endurance needed for the counter-attacking runs that create the best striker goal opportunities.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Striker Speed-Endurance — Anaerobic 5 × 40m', '5', '40m', '25s rest',
      `🎯 TARGET: Zone 5 anaerobic capacity | 90% effort, extremely short recovery

SESSION PLAN: Sprint 40m at 90% effort. 25s walk rest. 5 reps. HR will be 180–190+ bpm throughout. Do not extend rest — the incomplete recovery is the point.

STRIKER FOCUS: 40m is your counter-attack run distance — the sprint that breaks the defensive line and creates a one-on-one. Rep 5 at 90% proves you can do it in the 90th minute.

WHY: 40m with 25s rest trains the extreme anaerobic capacity that allows strikers to maintain sprint quality when the game is won or lost.`,
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    ],

    Peak: [ex(
      'Striker Match-Day Activation — Sprint + Jump Finisher',
      '3', '3 × 15m sprint then CMJ', '3:00 between sets',
      `🎯 TARGET: Zone 5 CNS activation | MAX effort every sprint and jump, FULL set recovery

SESSION PLAN:
Mark 15m. Each set: 3 × 15m sprints (15s walk between sprints), then immediately perform 1 maximal countermovement jump (CMJ) as the set finisher.

Sprint 1: Standing start. Sprint 15m at 100%.
15s walk rest.
Sprint 2: Sprint 15m at 100%.
15s walk rest.
Sprint 3: Sprint 15m at 100%.
No rest — immediately jump as high as possible (CMJ).
Then 3:00 full rest before set 2.

CMJ technique: stand feet hip-width, arms back, dip quickly, drive arms UP explosively, jump for maximum height. Land softly.

STRIKER FOCUS: The 3 sprints + CMJ sequence mimics a striker's match moment: a channel run, a recovery sprint, a final burst — then a jump for a header at the end. Your body should feel primed, not fatigued, after this session.

WHY: This pre-match week activation uses sprint-then-jump post-activation potentiation (PAP). Sprinting before a jump increases jump height by 5–8%. Your nervous system arrives at match day already primed.`,
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    ex('Striker Match-Day Activation — 8 × 10m Varied Starts', '8', '10m', '45s rest',
      `🎯 TARGET: Zone 5 | Maximum first-step from every position, full recovery

SESSION PLAN: 8 × 10m at 100%, each from a different position: standing, crouched, back to direction, lateral shuffle → go, on-one-knee → go, walking → go, jogging → go, standing (repeat). 45s rest.

STRIKER FOCUS: Every starting position is a real match scenario. React from each position with maximum first-step explosiveness. This variety primes every movement pattern you need on Saturday.

WHY: Varied-start sprint priming is the most comprehensive pre-match activation for explosive athletes. 8 reps, 45s rest = zero fatigue.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Striker Match-Day Activation — 4 × 15m Behind-Defender Runs', '4', '15m', '2:00 rest',
      `🎯 TARGET: Zone 5 | 95% effort, full recovery

SESSION PLAN: Sprint 15m at 95% effort from a position sideways-on (simulate timing a run off the last defender). 2:00 full rest. 4 reps. Focus on the timing of the first step — hip rotation + drive.

STRIKER FOCUS: Time your first step as if the ball is played in behind the defence. Late start, explosive acceleration. This is the run that scores goals.

WHY: 4 high-quality reps with full recovery keeps the neuromuscular system sharp without creating match-day fatigue.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Striker Match-Day Activation — Explosive 3-sprint Triples', '3', '3 × 10m (15s rest)', '3:00 rest',
      `🎯 TARGET: Zone 5 | Maximum output, full set recovery — neural priming

SESSION PLAN: 3 × 10m at 100%, 15s rest between sprints = 1 triple. 3:00 full rest between 3 triples. 9 total sprints. Simple and effective.

STRIKER FOCUS: Triple 1 from standing. Triple 2 from back-to-direction (simulate spinning away from a defender). Triple 3 from standing — this should feel as fast as triple 1.

WHY: Sprint triples prime the fast-twitch neuromuscular system with minimal fatigue. The goal is to arrive at the match sharper, not more tired.`,
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ],
  },
};

// ── Low-impact cross-training conditioning (MD-2) ─────────────────────────
// Used 2 days before match. Bike / pool / ergometer only.
// Goal: maintain aerobic sharpness without loading the running muscles.
const CONDITIONING_MD2: Record<PosKey, Record<string, ProgrammeExercise>> = {
  GK: {
    Foundation: ex('Stationary Bike: Aerobic Ride', '1', '15 min at 65% max HR', '', 'Steady, comfortable pace. HR 120–135. Active recovery — flush legs without loading them.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Stationary Bike: 20s Sprint / 40s Easy', '6', 'rounds (6 min total)', '3:00 after all rounds', '20s maximum effort, 40s easy pedalling. Non-impact explosive stimulus.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    'Strength & Power': ex('Stationary Bike: Tempo Effort', '3', '3 min at 80% max HR', '90s rest', 'Sustained effort. HR 140–155. Aerobic power stimulus — zero ground impact.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('Stationary Bike: Activation Ride', '1', '10 min at 70% max HR', '', 'Light spin — elevate HR, prime legs. HR 130–145. No fatigue.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
  CB: {
    Foundation: ex('Cycle Ergometer: Steady Aerobic', '1', '20 min at 65% max HR', '', 'Moderate pace. HR 115–130. Zero joint impact — preserve legs for match.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Cycle Ergometer: 30s On / 30s Off', '8', 'rounds (8 min total)', '3:00 after all rounds', '30s hard (HR > 85%), 30s easy spin. Non-impact lactate work.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    'Strength & Power': ex('Cycle Ergometer: Threshold Intervals', '4', '4 min at 85% max HR', '2:00 rest', 'Sustained hard effort. Non-running aerobic output. Avoid impact.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('Cycle Ergometer: Flush Spin', '1', '12 min at 60% max HR', '', 'Easy spin. Metabolic flush. HR < 125. Zero fatigue.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
  FB: {
    Foundation: ex('Pool Running or Light Swim', '1', '20 min continuous', '', 'Buoyancy eliminates ground impact. HR 120–135. Full-back aerobic maintenance.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Stationary Bike: 45s Hard / 15s Easy', '6', 'rounds (6 min total)', '3:00 after all rounds', '45s strong effort (HR 140–155), 15s easy. Aerobic power without impact.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    'Strength & Power': ex('Cycle Ergometer: Tempo Ride', '1', '18 min at 75–80% max HR', '', 'Consistent tempo effort. HR 140–155. Aerobic base — no running load.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Peak: ex('Stationary Bike: Activation', '1', '10 min at 65% max HR', '', 'Easy priming spin. HR 120–130. Preserve full-back legs — match tomorrow.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
  CM: {
    Foundation: ex('Cycle Ergometer: Aerobic Base', '1', '20 min at 65–70% max HR', '', 'Conversational effort on the bike. HR 120–135. Maintains aerobic base without running volume.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Stationary Bike: 30s Sprint / 30s Recovery', '8', 'rounds (8 min total)', '3:00 after all rounds', '30s maximal effort, 30s easy. Box-to-box aerobic-anaerobic stimulus — no impact.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    'Strength & Power': ex('Cycle Ergometer: Threshold Intervals', '4', '4 min at 85% max HR', '2:00 rest', '30-15 equivalent output on the bike. HR > 85%. Non-impact.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('Cycle Ergometer: Flush Ride', '1', '12 min at 60% max HR', '', 'Easy spin. Legs loose and fresh. HR < 120. CM match-day readiness.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
  W: {
    Foundation: ex('Stationary Bike: Aerobic Ride', '1', '15 min at 65% max HR', '', 'Steady effort. HR 120–130. Maintain aerobic sharpness — protect winger legs.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Stationary Bike: 15s Sprint / 45s Recovery', '8', 'rounds (8 min total)', '3:00 after all rounds', '15s all-out sprint cadence, 45s easy spin. Winger burst pattern — zero impact.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    'Strength & Power': ex('Stationary Bike: Speed-Endurance', '3', '2 min at 85% max HR', '90s rest', 'Sustained hard effort. HR > 85%. Non-running speed-endurance stimulus.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('Stationary Bike: Activation', '1', '8 min at 60% max HR', '', 'Light spin. Legs primed, not taxed. HR 115–125. Winger freshness preserved.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
  ST: {
    Foundation: ex('Cycle Ergometer: Steady Ride', '1', '15 min at 65% max HR', '', 'Easy, comfortable effort. HR 115–130. Aerobic maintenance — striker legs stay fresh.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('Stationary Bike: 10s Max / 50s Easy', '8', 'rounds (8 min total)', '3:00 after all rounds', '10s maximal sprint cadence, 50s easy spin. Mirrors striker sprint pattern — no impact.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    'Strength & Power': ex('Cycle Ergometer: Power Intervals', '4', '3 min at 80% max HR', '90s rest', 'Strong, sustained effort. HR 140–155. Anaerobic capacity — non-impact.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('Stationary Bike: Flush Spin', '1', '10 min at 60% max HR', '', 'Easy spin to flush legs. HR < 120. Striker freshness for match — no fatigue.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
  },
};

/** Returns run-based conditioning for a position/phase, rotated by weekNum for variety. */
export function getRunCondEx(posKey: PosKey, phase: string, weekNum = 0): ProgrammeExercise {
  const arr = CONDITIONING[posKey]?.[phase] ?? CONDITIONING.CM.Foundation;
  return arr[weekNum % arr.length];
}

// ── In-session conditioning: Aerobic Base & High Intensity Intervals ──────
// Evidence basis:
//   Aerobic base: Helgerud et al. 2001 — cardiac output / Z2 work increases stroke volume,
//     VO₂max and capillary density. Minimum 2 weeks required before high-intensity loading
//     (Malone et al. 2017, Gabbett acute:chronic workload ratio principle).
//   HIIT: Dupont 15/15 (2004), Helgerud 4×4 (2007) — highest VO₂max stimulus per unit time.
//     RSA protocols (Buchheit 2013) for match-specific repeated sprint fitness.
//   Progression: weeks 1-2 aerobic only → progressive HIIT introduction → 50/50 maintenance.

// 4 aerobic variants per training phase — rotated via session seed (no back-to-back repeats)
const CONDITIONING_AEROBIC: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('Cardiac Output Run', '1', '30 min @ 65–70% HRmax', '—',
      'Conversational pace — you should be able to hold a full sentence throughout. This is not easy jogging: it is deliberate cardiac training. 65–70% HRmax builds stroke volume, increases capillary density, and lowers resting heart rate. Foundation phase weeks 1–2: aerobic base only to reduce connective tissue injury risk before higher intensities are introduced. No watch needed — use the talk test.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Extensive Aerobic Intervals', '6', '4 min on · 2 min walk', '2:00 walk',
      'Run each 4-minute rep at 72–75% HRmax — comfortable but purposeful. Walk recovery between reps. 6 reps = 24 min total work. This protocol maximises aerobic volume while managing fatigue. Evidence: Helgerud et al. (2001) — interval aerobic at 75% HRmax produces superior cardiac adaptations to continuous running at matched volume.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Aerobic Threshold Run', '1', '20 min @ 75% HRmax', '—',
      'Comfortably hard — you can speak in short phrases but not hold a full conversation. Just below lactate threshold. Builds lactate clearance capacity and aerobic power. Foundation phase: keep strictly to 75% — no heroics. This is infrastructure work.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Progressive Aerobic Run', '1', '25 min (build from 65% → 75%)', '—',
      'First 10 min @ 65% HRmax (conversational), middle 10 min @ 70% (comfortable effort), final 5 min @ 75% (purposeful push). Progressive cardiac drift training — teaches your aerobic system to sustain output as intensity rises. Football demands sustained output across fatigue: this trains it.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
  ],
  Build: [
    ex('Extended Cardiac Output Run', '1', '35 min @ 70–75% HRmax', '—',
      'Extended aerobic volume session. 70–75% HRmax throughout — sustainable effort with clear intent. Build phase cardiac output run: volume increased from Foundation. Sustained stroke volume stimulus. Fatigue management: this should feel manageable the day before strength training.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Threshold Intervals', '5', '5 min on · 90s walk', '90s walk',
      '5 min at 78–82% HRmax — firmly at lactate threshold. 90s walk recovery. 5 reps = 25 min threshold work. This is where aerobic power is built. Evidence: Helgerud (2001) — threshold intervals drive the greatest improvement in running economy for football players at this phase.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Sustained Threshold Run', '1', '25 min @ 78% HRmax', '—',
      'Hold 78% HRmax for the full 25 minutes without letting intensity drop. This is the Build phase benchmark: can you sustain threshold for 25 continuous minutes? If not, drop to 75% and build. If yes, push the pace slightly in the final 5 minutes.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Aerobic Fartlek', '1', '25 min mixed Z2/Z3', '—',
      'Run 25 minutes at 70% HRmax base pace. Every 5 minutes insert a 1-minute surge to 82% HRmax, then return to base. 4 surges total. Unstructured intensity variation builds adaptability in aerobic energy system. Evidence: Fartlek training (Gerschler 1939, Åstrand 1960) — superior to continuous running for mixed-intensity aerobic development.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
  ],
  'Strength & Power': [
    ex('Aerobic Maintenance Run', '1', '30 min @ 70% HRmax', '—',
      'Aerobic maintenance during peak strength phase. Volume maintained, intensity conservative. The goal here is to not lose the aerobic gains from Foundation/Build while strength work is the priority. 70% HRmax is enough stimulus to maintain cardiac adaptations without adding meaningful fatigue.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Reduced Threshold Intervals', '4', '6 min on · 2 min walk', '2:00 walk',
      'Volume reduced from Build to manage cumulative fatigue during heavy strength training. 4 reps × 6 min at 78% HRmax. Quality over quantity in Strength & Power phase — the intervals themselves stay hard, there are just fewer of them.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Aerobic Threshold Maintenance', '1', '22 min @ 76% HRmax', '—',
      'Shorter than Build phase to account for strength fatigue. Hold 76% HRmax for 22 minutes. Maintenance dose for lactate clearance capacity. If feeling strong, final 5 min can push to 80%.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Mixed Aerobic Circuit', '3', '8 min · build 65% → 78%', '2:00 walk',
      'Three 8-minute aerobic blocks each increasing in intensity: block 1 @ 65%, block 2 @ 72%, block 3 @ 78% HRmax. 2-minute walk between blocks. Progressive stimulus within a lower total volume session — appropriate aerobic maintenance alongside heavy gym work.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
  ],
  Peak: [
    ex('Easy Aerobic Run', '1', '20 min @ 65% HRmax', '—',
      'Peak phase: low volume, low intensity aerobic. Active recovery function only — do not push the effort. The goal is blood flow and recovery, not fitness gains. Fitness is already built. 65% HRmax, fully conversational, enjoy it.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Aerobic Maintenance Intervals', '3', '5 min on · 2 min walk', '2:00 walk',
      'Minimum effective aerobic dose during taper. 3 reps × 5 min at 75% HRmax. Evidence: Mujika & Padilla (2003) taper research — volume can be reduced by 40–60% with no fitness loss if intensity is maintained. 3 reps is enough.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Light Aerobic Run', '1', '15 min @ 68% HRmax', '—',
      'Brief aerobic session to maintain blood flow and aerobic feel during peak week. No physiological loading intended. Well below threshold.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
    ex('Activation Jog', '1', '15 min with 3 × 30s pickups', '—',
      '15 minutes @ 65% HRmax. Every 5 minutes insert one 30-second acceleration to 85%. Peak activation session: minimal fatigue, maximal neural readiness. Last aerobic session before competition.',
      { methodType: 'concentric', intensityIntent: 'submaximal', isRunning: true }),
  ],
};

// 4 HIIT variants per training phase — introduced progressively after week 2
// Evidence: Buchheit & Laursen (2013) — HIIT classification and prescription for team sports
const CONDITIONING_HIIT: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('15/15 HIIT — Introduction', '16', '15s sprint · 15s jog', '—',
      '16 reps of 15s at 120% MAS (maximal aerobic speed) + 15s active jog. First exposure to HIIT: 16 reps is conservative volume. Evidence: Dupont et al. (2004) — 15/15 at 120% MAS produces the highest VO₂max stimulus per unit time of any running protocol. Find your MAS: pace you can hold for exactly 6 minutes flat-out. 120% = noticeably faster than that pace. Every rep should feel hard but completable.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Short HIIT Intervals — Foundation', '8', '30s hard · 30s walk', '—',
      '8 reps of 30s at 95–100% HRmax + 30s passive walk. Foundation HIIT entry point: 8 reps total. Each 30s rep should be near-maximal running effort — not a sprint, but as fast as you can sustain for 30s. Walk completely between reps. Total hard work: 4 minutes at near-maximal. Evidence: Wisloff et al. (2007) — short supramaximal intervals drive VO₂max in less-trained athletes.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Sprint RSA Introduction', '3', '6 × 30m · 25s rest', '2:00 between sets',
      '3 sets of 6 × 30m flat-out sprints with 25s passive recovery between sprints, 2 min between sets. RSA introduction at conservative volume. Evidence: Impellizzeri et al. (2008) — repeated sprint ability is a key physical determinant of football performance, and the 30m/25s protocol closely replicates match demands. First exposure: 3 sets only.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('30/30 Protocol — Foundation', '10', '30s @ 105% MAS · 30s jog', '—',
      '10 reps of 30s at 105–110% MAS + 30s jog. Intermediate HIIT — higher volume than 15/15 but lower peak intensity. 105% MAS = slightly faster than your 6-minute test pace. Evidence: Buchheit & Laursen (2013) — 30/30 at 105% MAS develops both VO₂max and lactate buffering simultaneously.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
  ],
  Build: [
    ex('15/15 HIIT — Full Volume', '24', '15s sprint · 15s jog', '—',
      '24 reps of 15s at 120% MAS + 15s active jog. Full Dupont protocol. Evidence: Dupont et al. (2004) — 24 reps optimises cardiac output stimulus without excessive glycolytic fatigue. 120% MAS: you should feel like you cannot continue past 10-12 seconds but must hold it. Active jog (not walk) between reps is critical — maintains blood lactate clearance.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('Norwegian 4×4 HIIT', '4', '4 min @ 90–95% HRmax · 3 min jog', '3:00 jog',
      '4 sets of 4 minutes at 90–95% HRmax with 3-minute active jog recovery. Gold-standard VO₂max protocol. Evidence: Helgerud et al. (2007) — 4×4 at 90–95% HRmax produced a 10.8% VO₂max increase in football players over 8 weeks, superior to moderate-intensity training. Finishing sets 3 and 4 should feel very difficult — that is correct.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('RSA Block Training', '4', '8 × 40m · 25s passive rest', '2:00 between sets',
      '4 sets of 8 × 40m flat-out sprints. 25s passive recovery between sprints, 2 min between sets. Match-replication RSA protocol. Evidence: Buchheit et al. (2010) — 40m/25s closely mirrors the work-to-rest ratios of high-intensity football actions. Rep 8 should be within 5% of Rep 1 for adequate fitness.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('40/20 HIIT Protocol', '10', '40s @ 110% MAS · 20s walk', '—',
      '10 reps of 40s at 110% MAS + 20s passive walk. Power-endurance development — longer work period than 15/15 builds lactate tolerance alongside VO₂max. Evidence: Buchheit & Laursen (2013) — 40/20 at 110% MAS extends the high-intensity stimulus window compared to shorter protocols while keeping total fatigue manageable.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
  ],
  'Strength & Power': [
    ex('15/15 HIIT — Strength Phase', '20', '15s sprint · 15s jog', '—',
      '20 reps of 15s at 120% MAS + 15s jog. Volume reduced from Build (24 reps → 20) to account for cumulative strength training fatigue. Intensity maintained. Evidence: Mujika & Padilla (2003) — volume reduction with intensity maintenance preserves VO₂max during concurrent training phases.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('3×4 HIIT — Reduced Volume', '3', '4 min @ 92% HRmax · 4 min jog', '4:00 jog',
      '3 sets of 4 min at 92% HRmax + 4 min jog recovery (increased from 3 to 4 min to support recovery during strength-dominant phase). Reduced from 4×4 Build protocol. Maintains VO₂max stimulus at lower total volume.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('RSA Maintenance Sprints', '3', '6 × 30m · 30s rest', '2:00 between sets',
      '3 sets of 6 × 30m sprints, 30s passive recovery between sprints. Maintenance RSA dose during Strength & Power phase. Total sprint volume reduced from Build but quality maintained. Every rep flat-out.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('Match Simulation Intervals', '3', '5 min high-intensity · 2 min jog', '2:00 jog',
      '3 sets of 5 minutes at mixed high intensity (alternating 80% and 95% HRmax within each rep) + 2 min jog. Simulates the irregular high-intensity demand of a football match. No fixed pace — react to effort: hard when it feels manageable, very hard when it does not.',
      { methodType: 'mixed', intensityIntent: 'maximal', isRunning: true }),
  ],
  Peak: [
    ex('15/15 HIIT — Express', '12', '15s sprint · 15s jog', '—',
      '12 reps of 15s at 120% MAS + 15s jog. Minimum effective HIIT dose during peak/taper phase. Evidence: Mujika (2010) — 12 reps maintains acute VO₂max stimulus without the fatigue accumulation of full 24-rep protocol. Quality is everything here — 12 perfect reps beats 20 tired ones.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('2×4 HIIT — Peak Taper', '2', '4 min @ 90% HRmax · 4 min jog', '4:00 jog',
      '2 sets only of 4 min at 90% HRmax + 4 min jog. Bare minimum to maintain cardiovascular sharpness before competition. Low volume, full intensity. The aerobic engine is built — this just keeps it switched on.',
      { methodType: 'concentric', intensityIntent: 'maximal', isRunning: true }),
    ex('RSA Activation Sprints', '2', '6 × 30m · 2 min rest', '3:00 between sets',
      '2 sets of 6 × 30m max sprints. Extended rest (2 min between reps, 3 min between sets) to ensure full CNS recovery. Peak phase: this is sprint quality maintenance, not conditioning. Every rep must feel fast.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('Short Sprint Activation', '3', '4 × 20m · 90s rest', '2:30 between sets',
      '3 sets of 4 × 20m flat-out sprints with full recovery. CNS activation without fatigue accumulation. Peak-week purpose: stay sharp, stay fast. Do not add volume.',
      { methodType: 'reactive', intensityIntent: 'explosive', isRunning: true }),
  ],
};

// Day-of-week seed — ensures consecutive sessions within and across weeks never repeat
// e.g. Mon (0) and Wed (2) in the same week produce different variants
const DAY_SEED: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

/**
 * Selects the in-session conditioning exercise — guarantees TWO DIFFERENT TYPES each week.
 *
 * Strategy: split the week into two halves by day index.
 *   Half-0 (Mon–Wed, dayIdx 0–2) and Half-1 (Thu–Sun, dayIdx 3–6).
 *   After week 2, one half = aerobic, the other = HIIT.
 *   Week parity flips which half gets HIIT so types rotate each week.
 *
 * Progression model (evidence: Malone et al. 2017, Gabbett 2016):
 *   Weeks 1–2  → 100% aerobic (injury prevention, connective tissue adaptation)
 *   Weeks 3+   → Half-week alternation: aerobic one day, HIIT another — both types every week
 *
 * Variant rotation: within each type, variants rotate using Math.floor(weekNum / 2)
 * so each variant gets ~2 weeks before cycling — prevents stagnation without repetition.
 */
function getConditioningBlock(
  phase: string,
  weekNum: number,
  dayOfWeek: string,
): { ex: ProgrammeExercise; blockTitle: string; methodFocus: string } {
  const dayIdx = DAY_SEED[dayOfWeek] ?? 0;

  // Split week into two halves: Mon/Tue/Wed = 0, Thu/Fri/Sat/Sun = 1
  const halfWeek = dayIdx >= 3 ? 1 : 0;

  // Weeks 0-1: always aerobic. Week 2+: alternate halves; flip each week so
  // if Mon was aerobic this week, next week Mon is HIIT.
  const useHiit = weekNum >= 2 && ((halfWeek + weekNum) % 2 === 1);

  const aerobicArr = CONDITIONING_AEROBIC[phase] ?? CONDITIONING_AEROBIC.Foundation;
  const hiitArr    = CONDITIONING_HIIT[phase]    ?? CONDITIONING_HIIT.Foundation;

  // Variant index rotates every 2 weeks to avoid the same exercise repeating week-on-week.
  // halfWeek offset (0 or 1) ensures the two sessions WITHIN a week always use different variants —
  // even when both sessions are the same type (e.g. both aerobic in weeks 0–1).
  const baseVariant = Math.floor(weekNum / 2);
  const variantIdx = baseVariant + halfWeek; // offset by half so Mon ≠ Thu even within same type

  if (useHiit) {
    return {
      ex: hiitArr[variantIdx % hiitArr.length],
      blockTitle: '⚡ High Intensity Intervals',
      methodFocus: 'Football-specific HIIT. Maximum aerobic power and repeated sprint ability — the key physical determinants of match performance (Dupont 2004, Helgerud 2007, Buchheit 2013). Complements the aerobic session earlier in the week.',
    };
  }

  return {
    ex: aerobicArr[variantIdx % aerobicArr.length],
    blockTitle: '🏃 Aerobic Base',
    methodFocus: weekNum < 2
      ? 'Weeks 1–2: aerobic base only. Connective tissue and cardiac infrastructure built before high-intensity loading — evidence: Malone et al. (2017) injury prevention window.'
      : 'Cardiac output and aerobic infrastructure. Complements the HIIT session later in the week — both types every week for balanced conditioning development.',
  };
}

// ── Weakness exercises ─────────────────────────────────────────────────────

const WEAKNESS_EX: Record<string, ProgrammeExercise[]> = {
  speed: [
    ex('Hip Flexor Sprint Drill', '3', '4 × 20m', '2:00', 'Rapid knee drive. Arms drive speed.',
      { methodType: 'concentric', intensityIntent: 'explosive', isRunning: true }),
    ex('Single-Leg Broad Jump', '3', '5 each', '2:00', 'Push horizontally off one foot. Land controlled. Max distance.',
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
    ex('Cardiac Output Circuit', '3', '5 min', '90s rest', '1 min jog / 1 min bike / 1 min row / 1 min step / 1 min jump rope. HR 130–150.',
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
  agility: [
    ex('5-10-5 Pro Agility Drill', '4', 'Full shuttle', '2:30', '5m right, 10m left, 5m right. Drive off outside foot each turn.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('T-Drill', '3', 'Full drill', '2:30', 'Sprint, shuffle left, shuffle right, back-pedal. Precise footwork at each cone.',
      { methodType: 'reactive', intensityIntent: 'maximal', isRunning: true }),
    ex('Reactive Cone Drill (Partner)', '4', '6 reps', '2:00', 'Partner signals direction. React and accelerate. Decision speed is the variable.',
      { methodType: 'reactive', intensityIntent: 'reactive', isRunning: true }),
  ],
  injury_prone: [
    ex('Single-Leg Romanian Deadlift (Stability)', '2', '6 each', '90s', 'Hinge to shin — full hip extension at the top. Drive through the standing heel. Hip stability and hamstring activation for injury-resilient athletes.',
      { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'maximal' }),
  ],
};

// ── Prehab by injury area ──────────────────────────────────────────────────

const PREHAB: Record<string, ProgrammeExercise[]> = {
  hamstring: [
    ex('Nordic Hamstring Curl', '3', '2', '3:00', '4s eccentric — maximum effort, 2 reps only. Highest-evidence prevention. Non-negotiable.',
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
    ex('Isometric Wall Sit — Single-Leg at 60°', '3', '30s each', '2:00', '60° knee flexion against wall — single leg. Maximum effort. This is the clinically-validated patellar tendon HSR angle: heavy isometric at 60° directly increases patellar tendon stiffness. The tendon then absorbs more landing/deceleration load so the quad muscle doesn\'t overwork.',
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
    ex('Heavy Single-Leg Calf Isometric Hold', '3', '30s each', '90s', 'Rise onto single-leg tiptoe. Hold maximum effort — add weight via DB if possible. Achilles tendon HSR: heavy slow resistance increases tendon stiffness so the tendon (not the calf muscle) absorbs the sprint push-off load.',
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
const DEFAULT_PREHAB: ProgrammeExercise[] = [
  ex('Eccentric Single-Leg Calf Raise', '2', '10 each', '60s', 'Rise on two legs, lower on one over 3s. Achilles and calf resilience — baseline eccentric maintenance for all footballers.',
    { tempo: '1-0-3-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
];

// ── Apply readiness — reduce sets and intensity ────────────────────────────

function applyReadiness(
  exs: ProgrammeExercise[],
  level: ReadinessLevel,
  intensityNote: string,
): ProgrammeExercise[] {
  if (level === 'elite') {
    // Add bonus set cue to main sets
    return exs.map((e, i) => i === 0
      ? { ...e, sets: String(Number(e.sets) + 1), intensity: e.intensity ? `${e.intensity} (bonus set)` : 'Add 1 bonus set' }
      : e,
    );
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

// ── Recovery session (MD+1) ────────────────────────────────────────────────

function recoverySession(dow: string): ProgrammeSession {
  return {
    mdDay: 'MD+1',
    dayOfWeek: dow,
    objective: 'MD+1 — Active Recovery. Objective: analgesia (pain reduction) and clearing metabolites. Yielding isometrics and concentric-only cardio only. No eccentric loading — muscle fibres are already dealing with micro-tears from the match.',
    readinessNote: 'MD+1 is ALWAYS low load regardless of readiness score. The biggest mistake is passive stretching or heavy eccentric lifting today. Muscle fibres are already dealing with micro-tears from the match. Protect them.',
    durationMin: 30,
    fvProfile: 'Recovery — yielding isometrics and concentric cardio only. Zero eccentric load.',
    blocks: [
      {
        title: '🚴 Concentric Cardio (15 min)',
        methodFocus: 'Bike or easy walk — concentric only. Flushes the legs without stretching torn tissue. HR below 120 bpm throughout. This is not a training stimulus.',
        exercises: [
          ex('Low-Intensity Cycling or Easy Walk', '1', '15 min at RPE 2–3', '', 'HR below 120 bpm. Legs should feel slightly better after this, not worse. Pedal with low resistance — this is a metabolite flush, not a workout.',
            { intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '🧘 Yielding Isometric Holds',
        methodFocus: 'Isometric holds at RPE 3–4 — should feel like a warm hug for the joints, not a workout. No eccentric loading. 2 sets × 45 seconds.',
        exercises: [
          ex('Single-Leg Glute Bridge Hold', '2', '30s each side', '60s', 'Shoulders on floor, hips extended, squeeze glute. RPE 3–4 — this is analgesia, not strength training. Breathe steadily. The goal is blood flow and pain reduction, not force production.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Wall Sit (Bilateral)', '2', '30s', '60s', 'Back flat against wall. Knees at 90°. RPE 3–4. Quadriceps isometric hold — reduces muscle soreness without adding eccentric damage. Breathe steadily throughout.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Prone Hamstring Isometric Hold', '2', '30s each side', '60s', 'Face down, ankle hooked under a fixed surface. Pull heel toward glute and hold. RPE 3–4. Hamstring isometric at mid-length — reduces DOMS without the eccentric loading that would add more micro-damage.',
            { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '🔄 Hip & Ankle Mobility',
        methodFocus: 'Restore range of motion — gentle, non-fatiguing. Match soreness reduces ROM; restore it slowly.',
        exercises: [
          ex('Hip 90/90 Mobilisation', '1', '60s each side', '', 'Breathe into end range. Never force it. Restore hip ROM lost from match day.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Supine Knee Hug', '1', '30s each side', '', 'Pull knee gently to chest. Hold at end range. Light and parasympathetic — restore hip flexor length lost from match day.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
    ],
  };
}

// ── Neural priming session (MD-1) ──────────────────────────────────────────

function primingSession(dow: string, position: string, playStyle: string): ProgrammeSession {
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

  const styleNote = playStyle === 'counter-attack'
    ? 'Counter-attack play style: pay particular attention to transition speed cues tomorrow.'
    : playStyle === 'press-heavy'
    ? 'Press-heavy style: priming mirrors press triggers — short, sharp, full effort, immediate reset.'
    : 'Neural priming only. Low volume, maximum quality. Arrive tomorrow sharp, not heavy.';

  return {
    mdDay: 'MD-1',
    dayOfWeek: dow,
    objective: `MD-1 — Priming Session. Objective: wake up the nervous system (Post-Activation Potentiation) with zero metabolic cost. 2 sets × 2–3 reps. Bodyweight or very light load only. ${styleNote}`,
    readinessNote: 'MD-1 is ALWAYS low load — do NOT add sets or intensity regardless of readiness score. The goal is CNS activation, not fatigue. You should leave this session feeling MORE energetic than when you arrived.',
    durationMin: 25,
    fvProfile: 'Speed end of F-V curve — light load, maximal velocity intent, zero accumulated fatigue.',
    blocks: [
      {
        title: '🔥 Movement Prep (8 min)',
        methodFocus: 'Mobility and CNS ramp — prepare joints and nervous system. Light and fast.',
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
        methodFocus: 'Post-Activation Potentiation — biomechanical execution matches your primary match-day demands. 2 sets only. Full CNS recovery between sets.',
        exercises: positionPriming[position] ?? [
          ex('Countermovement Jump', '2', '3 reps', '2:00', 'Max height. Stick landing 1s. Full rest between reps. Neural activation only.',
            { methodType: 'reactive', intensityIntent: 'explosive' }),
        ],
      },
      {
        title: '🛡️ Pre-Match Prehab',
        methodFocus: 'Sub-maximal eccentric and isometric — protect soft tissue, not stimulate it.',
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

// ── Session objective labels ───────────────────────────────────────────────

const MD4_OBJ: Record<string, string> = {
  Foundation: 'High Demand Strength Day — CNS is freshest here. Objective: max strength and high-threshold motor unit recruitment. 2 working sets, 3–5 reps, 85%+ 1RM. RIR 1–2: bar moves with intent, not a grind.',
  Build: 'High Demand Strength Day — further from match means heavier load. Drive strength adaptation today: 2 working sets, 85%+ 1RM, explosive concentric intent. This is where physical gains are made.',
  'Strength & Power': 'High Demand Strength Day — peak force production. 2 working sets at the heaviest loads of the programme. Every rep is neural — treat it that way.',
  Peak: 'High Demand Strength Day — express peak strength. Reduced volume, maximum intensity. 2 sets, 2–3 reps, 90%+ 1RM.',
};

const MD3_OBJ: Record<string, string> = {
  Foundation: 'Structural Day — tissue architecture and fascicle length. 2–3 sets, 5–8 reps, 70–80% 1RM. Eccentric emphasis: DOMS peaks at 48h, so by match day it is completely cleared. Structural resilience is built today.',
  Build: 'Structural Day — drive hypertrophy and fascicle length adaptation. Moderate load, higher reps, eccentric tempo. DOMS from today\'s eccentric work peaks at 48h — gone by Saturday. This is the science of smart scheduling.',
  'Strength & Power': 'Structural Day — maintain tissue quality under an accumulating programme. 2–3 sets, 5–8 reps, 70–80% 1RM. Eccentric slider curls and single-leg RDLs are the priority.',
  Peak: 'Structural Day — minimum effective dose. 2 sets, 6–8 reps. Maintain fascicle length without generating new fatigue.',
};

const MD2_OBJ: Record<string, string> = {
  Foundation: 'The Forbidden Zone — 2 days from match. Zero heavy lifting. The pitch is the priority today. Micro-dosed power only: 2 sets × 3 reps at 30–40% 1RM, maximal velocity. No fatigue carryover.',
  Build: 'The Forbidden Zone — 2 days from match. No heavy mechanical load. This is usually the heaviest tactical and sprint day on the pitch. Micro-dosed power only to maintain CNS sharpness without generating fatigue.',
  'Strength & Power': 'The Forbidden Zone — 2 days from match. Protect the legs entirely. If anything, micro-dosed power: 2 × 3 at 30–40% 1RM at max intent. Walk out of here fresh.',
  Peak: 'The Forbidden Zone — 2 days from match. Zero gym fatigue. Rest, eat, sleep. Arrive Saturday sharp.',
};

// ── Off-season session builder ─────────────────────────────────────────────
// No match-day context. Load alternates Heavy/Moderate based on schedule spacing.
// Full 5-block structure every session. DOMS managed by session spacing alone.

function buildOffSeasonSession(
  slot: OsSlot,
  inputs: ProgrammeInputs,
  phase: string,
  weekNum: number,
  readiness: { level: ReadinessLevel; volumeMultiplier: number; intensityNote: string },
): ProgrammeSession {
  const { biggestWeakness, injuryHistory, gymAccess } = inputs;

  // Use heavy load on heavy days, moderate on moderate days
  const loadScheme = slot.load === 'heavy' ? 'heavy' : 'moderate';
  const gymLib = STRENGTH_LIBRARY[phase] ?? STRENGTH_LIBRARY.Build;
  const gymAccessLib = gymLib[gymAccess as GymKey] ?? gymLib.basic;
  const strengthEx = gymAccessLib[loadScheme] ?? gymAccessLib.moderate;
  const upperPhase = UPPER[phase] ?? UPPER.Build;
  const upperEx = upperPhase[gymAccess as GymKey] ?? upperPhase.basic;

  const playStyleEx = PLAY_STYLE_EX[inputs.playStyle] ?? [];
  const weaknessEx = WEAKNESS_EX[biggestWeakness]?.slice(0, 2) ?? [];

  const prehabEx: ProgrammeExercise[] = [];
  for (const area of injuryHistory.slice(0, 2)) {
    const p = PREHAB[area];
    if (p) prehabEx.push(p[weekNum % p.length]);
  }
  if (prehabEx.length === 0) prehabEx.push(...DEFAULT_PREHAB);

  const gymKey = (gymAccess as GymKey) in POWER_PRIMER ? (gymAccess as GymKey) : 'basic';
  const pogoHops = TENDON_SSC_BLOCK[gymKey].slice(2);
  const prehabEccentric = prehabEx.filter(e => e.methodType === 'eccentric');

  // Running/speed exercises — seeded per (week, day) so every session in the same week
  // gets a DIFFERENT running exercise. Uses same DAY_SEED logic as getConditioningBlock.
  const _osDayIdx = DAY_SEED[slot.dayOfWeek] ?? 0;
  const _osSessionSeed = weekNum * 7 + _osDayIdx;
  const allPlayStyleRunning = (PLAY_STYLE_RUNNING[inputs.playStyle] ?? []).filter(e => e.isRunning);
  const playStyleRunning = allPlayStyleRunning.length > 0
    ? [allPlayStyleRunning[_osSessionSeed % allPlayStyleRunning.length]]
    : [];
  const allWeaknessRunning = weaknessEx.filter(e => e.isRunning);
  const weaknessRunning = allWeaknessRunning.length > 0
    ? [allWeaknessRunning[_osSessionSeed % allWeaknessRunning.length]]
    : [];
  const speedWorkEx = [...playStyleRunning, ...weaknessRunning];
  // Injury-based block ordering: eccentric FIRST if muscle injury present, isometric FIRST otherwise
  const hasMuscleInjury = injuryHistory.some(a => ['hamstring', 'groin', 'calf', 'knee'].includes(a));

  const loadLabel = slot.load === 'heavy' ? 'Heavy Day' : 'Moderate Day';
  const durationBase = slot.load === 'heavy' ? 70 : 60;
  const durationMin = readiness.level === 'low' ? durationBase - 15
    : readiness.level === 'elite' ? durationBase + 10
    : durationBase;

  // Include conditioning only for endurance-focused athletes
  const includeConditioning = inputs.primaryGoal === 'endurance' || inputs.biggestWeakness === 'endurance';
  const condBlock = getConditioningBlock(phase, weekNum, slot.dayOfWeek);

  const readinessNote =
    readiness.level === 'elite'
      ? 'Elite readiness ✦ — Add a bonus set. Chase a PB on your primary lift. Conditions are optimal.'
      : readiness.level === 'high'
      ? 'High readiness ✓ — Execute as written. 2–1 RIR on main sets.'
      : readiness.level === 'moderate'
      ? 'Moderate readiness — Drop load ~10%. RIR floor 2.'
      : 'Low readiness — 1 fewer set, −20–25% intensity. Movement quality is today\'s goal.';

  return {
    mdDay: loadLabel,
    dayOfWeek: slot.dayOfWeek,
    objective: `Off Season — ${loadLabel} · ${phase} · Wk ${weekNum}`,
    readinessNote,
    durationMin,
    fvProfile: slot.load === 'heavy'
      ? 'Off-season heavy day. High load, low reps, explosive concentric intent. No match to manage around — push the quality ceiling.'
      : 'Off-season moderate day. Controlled load, higher reps. Manage DOMS from the previous session — quality over intensity today.',
    blocks: [
      {
        title: '🔥 Warm-Up (12 min)',
        methodFocus: 'Mobility + concentric ramp — full joint prep before heavy loading',
        exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 2)],
      },
      {
        title: '🦘 Reactive Plyometrics — Pogos',
        methodFocus: 'High reps (15–20), 90s rest. Stiff ankles. Tendon spring at match-speed loading rate.',
        exercises: pogoHops,
      },
      {
        title: '⚡ Explosive Plyometrics — CMJ / Broad Jump',
        methodFocus: 'Low reps (2–3), full 3 min rest. Maximum neural output. No match to manage — express full power quality.',
        exercises: POWER_PRIMER[gymKey],
      },
      {
        title: '💪 Maximum Strength',
        methodFocus: slot.load === 'heavy'
          ? 'Off-season: no match day ceiling — push load to the limit. 5 exercises max · 3 lower / 2 upper · all maximum effort. Lower and upper interleaved — each group recovers while the other works.'
          : 'Moderate load — 5 exercises max · 3 lower / 2 upper · all maximum effort. Interleaved lower/upper. Quality over quantity.',
        exercises: applyReadiness(
          buildMaxStrengthBlock(
            selectVerticalSquat(inputs, phase, gymKey, loadScheme, strengthEx),
            strengthEx[1],
            upperEx,
            [
              ...(playStyleEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
              ...(biggestWeakness !== 'endurance'
                ? weaknessEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)
                : []),
            ],
          ),
          readiness.level,
          readiness.intensityNote,
        ),
      },
      ...(hasMuscleInjury ? [{
        title: '🔴 Eccentric Block',
        methodFocus: 'Muscle injury present — eccentric work comes first while fresh. Fascicle length adaptation is the primary protective mechanism.',
        exercises: [...ECCENTRIC_BLOCK[gymKey], ...prehabEccentric],
      }] : []),
      {
        title: '🦴 Isometric Block',
        methodFocus: 'Tendon HSR holds. Patellar + Achilles stiffness adaptation.',
        exercises: buildIsometricBlock(gymKey),
      },
      ...(!hasMuscleInjury ? [{
        title: '🔴 Eccentric Block — Always Last',
        methodFocus: 'Fascicle length adaptation. DOMS peaks 48h — sessions are spaced to manage this. Non-negotiable every session.',
        exercises: [...ECCENTRIC_BLOCK[gymKey], ...prehabEccentric],
      }] : []),
      ...(includeConditioning ? [{
        title: condBlock.blockTitle,
        methodFocus: condBlock.methodFocus,
        exercises: [condBlock.ex],
      }] : []),
      ...(speedWorkEx.length > 0 && !includeConditioning ? [{
        title: '🏃 Speed Work — Conditioning',
        methodFocus: 'Play-style and weakness speed work. Complete on the pitch — separate from the gym session.',
        exercises: speedWorkEx,
      }] : []),
    ],
  };
}

// ── Main session builder ───────────────────────────────────────────────────

function buildSession(
  slot: MdSlot,
  inputs: ProgrammeInputs,
  phase: string,
  weekNum: number,
  readiness: { level: ReadinessLevel; volumeMultiplier: number; intensityNote: string },
): ProgrammeSession {
  if (slot.mdDay === 'MD+1') return recoverySession(slot.dayOfWeek);
  if (slot.mdDay === 'MD-1') return primingSession(slot.dayOfWeek, inputs.position, inputs.playStyle);

  const { position, biggestWeakness, injuryHistory, gymAccess } = inputs;
  const fv = getFVProfile(slot.mdDay);

  // Strength library lookup
  const gymLib = STRENGTH_LIBRARY[phase] ?? STRENGTH_LIBRARY.Build;
  const gymAccessLib = gymLib[gymAccess] ?? gymLib.basic;
  const strengthEx = gymAccessLib[fv.loadScheme === 'heavy' ? 'heavy' : 'moderate'] ?? gymAccessLib.moderate;
  const upperPhase = UPPER[phase] ?? UPPER.Build;
  const upperEx = upperPhase[gymAccess as GymKey] ?? upperPhase.basic;

  const posKey = position as PosKey;
  void (POSITION_SPEED[posKey] ?? []);   // retained for future use
  void (SPEED_ACCELERATION[phase] ?? SPEED_ACCELERATION.Foundation);
  void (CONDITIONING[posKey]?.[phase] ?? CONDITIONING.CM.Foundation);   // array — retained for linting
  void (CONDITIONING_MD2[posKey]?.[phase] ?? CONDITIONING_MD2.CM.Foundation);
  const playStyleEx = PLAY_STYLE_EX[inputs.playStyle] ?? [];
  const weaknessEx = WEAKNESS_EX[biggestWeakness]?.slice(0, 2) ?? [];

  // Prehab selection
  const prehabEx: ProgrammeExercise[] = [];
  for (const area of injuryHistory.slice(0, 2)) {
    const p = PREHAB[area];
    if (p) prehabEx.push(p[weekNum % p.length]);
  }
  if (prehabEx.length === 0) prehabEx.push(...DEFAULT_PREHAB);

  const readinessNote =
    readiness.level === 'elite'
      ? 'Elite readiness ✦ — Add a bonus set. Target 1 RIR on every set. If bar velocity stays fast through all sets, chase a PB. Low-rep high-load: every rep is effective. Conditions are optimal.'
      : readiness.level === 'high'
      ? 'High readiness ✓ — Execute as written. 2–1 RIR on main sets. Every rep should be hard but technically sound. Autoregulate: stop any set if bar velocity drops >20% vs rep 1. No junk reps.'
      : readiness.level === 'moderate'
      ? 'Moderate readiness — Drop load ~10%. RIR floor 2. If any rep looks like a grind before prescribed reps are done, rack it. 3 quality reps beat 5 junk reps every time.'
      : 'Low readiness — 1 fewer set, −20–25% intensity. If bar speed deteriorates significantly (rep looks like a grind), end the set. Movement quality and controlled velocity are today\'s goals.';

  const durationBase = slot.mdDay === 'MD-4' ? 70 : slot.mdDay === 'MD-3' ? 60 : 55;
  const durationMin = readiness.level === 'low' ? durationBase - 15
    : readiness.level === 'elite' ? durationBase + 10
    : durationBase;

  // ── Session block order (non-negotiable) ────────────────────────────────
  // 1. Reactive Plyometrics  (Pogos — tendon spring, high rep, medium rest)
  // 2. Explosive Plyometrics (CMJ / Broad Jump — max CNS output, low rep, long rest)
  // 3. Maximum Strength      (heavy compound, upper body, play style, weakness)
  // 4. Isometric             (tendon HSR holds, prehab isometrics)
  // 5. Eccentric             (Nordics, Copenhagen — most structural stress, always last)
  // 6. Conditioning          (only when included — always after everything else)

  if (slot.mdDay === 'MD-4') {
    const gymKey = (gymAccess as GymKey) in POWER_PRIMER ? (gymAccess as GymKey) : 'basic';

    // Pogo hops (reactive) → Speed & Plyometrics block
    const pogoHops = TENDON_SSC_BLOCK[gymKey].slice(2);

    // Conditioning — only for endurance-focused athletes, placed LAST
    const includeConditioning = inputs.primaryGoal === 'endurance' || inputs.biggestWeakness === 'endurance';
    const condBlock = getConditioningBlock(phase, weekNum, slot.dayOfWeek);

    const prehabEccentric = prehabEx.filter(e => e.methodType === 'eccentric');
    // Running/speed exercises — seeded per (week, day) so every session in the same week
    // gets a DIFFERENT running exercise. Uses same DAY_SEED logic as getConditioningBlock.
    const _md4DayIdx = DAY_SEED[slot.dayOfWeek] ?? 0;
    const _md4SessionSeed = weekNum * 7 + _md4DayIdx;
    const allPlayStyleRunning = (PLAY_STYLE_RUNNING[inputs.playStyle] ?? []).filter(e => e.isRunning);
    const playStyleRunning = allPlayStyleRunning.length > 0
      ? [allPlayStyleRunning[_md4SessionSeed % allPlayStyleRunning.length]]
      : [];
    const allWeaknessRunning = weaknessEx.filter(e => e.isRunning);
    const weaknessRunning = allWeaknessRunning.length > 0
      ? [allWeaknessRunning[_md4SessionSeed % allWeaknessRunning.length]]
      : [];
    const speedWorkEx = [...playStyleRunning, ...weaknessRunning];
    const hasMuscleInjury = injuryHistory.some(a => ['hamstring', 'groin', 'calf', 'knee'].includes(a));

    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: `MD-4 — ${MD4_OBJ[phase] ?? MD4_OBJ.Build}`,
      readinessNote, durationMin,
      fvProfile: fv.profile,
      blocks: [
        {
          title: '🔥 Warm-Up (12 min)',
          methodFocus: 'Mobility + concentric ramp — full joint prep before heavy loading',
          exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 2)],
        },
        // ① Reactive Plyometrics — FIRST (Pogos / Ankle Hops)
        {
          title: '🦘 Reactive Plyometrics — Pogos / Ankle Hops',
          methodFocus: 'High-rep, medium rest (60–90s). Stiff ankles — minimise ground contact time. Trains the tendon spring at match-speed loading rate.',
          exercises: pogoHops,
        },
        // ② Explosive Plyometrics — after reactive (CMJ / Broad Jump)
        {
          title: '⚡ Explosive Plyometrics — CMJ / Broad Jump',
          methodFocus: 'Low reps (2–3), full 3 min rest between sets. Every rep is maximal intent. This is NOT conditioning — if you cannot give 100% on the next rep, extend the rest.',
          exercises: POWER_PRIMER[gymKey],
        },
        // ② Maximum Strength — strict order: vertical → horizontal → accessory → weakness LAST
        // NO eccentric exercises in this block — they go to block ④ only.
        {
          title: '💪 Maximum Strength',
          methodFocus: fv.loadScheme === 'heavy'
            ? 'Maximal force — 85%+ load, low reps, explosive concentric intent. 5 exercises max · 3 lower / 2 upper · all maximum effort. Lower and upper interleaved — bar velocity is your autoregulation signal.'
            : 'Strength-speed — high load with explosive intent. 5 exercises max · 3 lower / 2 upper · all maximum effort. Lower and upper interleaved.',
          exercises: applyReadiness(
            buildMaxStrengthBlock(
              selectVerticalSquat(inputs, phase, gymKey, fv.loadScheme as LoadKey, strengthEx),
              strengthEx[1],
              upperEx,
              [
                ...(playStyleEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)),
                ...(biggestWeakness !== 'endurance'
                  ? weaknessEx.filter(e => e.methodType !== 'eccentric' && e.methodType !== 'isometric' && !e.isRunning)
                  : []),
              ],
            ),
            readiness.level,
            readiness.intensityNote,
          ),
        },
        // ③/④ Isometric + Eccentric — order depends on injury history
        // Muscle injury present → Eccentric FIRST (fascicle adaptation priority)
        // No recurring muscle injury → Isometric FIRST (tendon stiffness priority)
        ...(hasMuscleInjury ? [{
          title: '🔴 Eccentric Block',
          methodFocus: 'Muscle injury present — eccentric work comes first while fresh. Fascicle length adaptation is the primary protective mechanism.',
          exercises: [...ECCENTRIC_BLOCK[gymKey], ...prehabEccentric],
        }] : []),
        {
          title: '🦴 Isometric Block',
          methodFocus: 'Heavy isometric holds — tendon stiffness adaptation (HSR protocol). Maximum effort throughout each hold. The tendon stiffens under heavy isometric load so it absorbs sprint/jump force instead of the muscle.',
          exercises: buildIsometricBlock(gymKey),
        },
        ...(!hasMuscleInjury ? [{
          title: '🔴 Eccentric Block — Always Last',
          methodFocus: 'Eccentric work placed LAST because it generates the most structural stress and residual DOMS. Nordic Curl fascicle-length adaptation is the primary hamstring strain prevention mechanism. Non-negotiable.',
          exercises: [...ECCENTRIC_BLOCK[gymKey], ...prehabEccentric],
        }] : []),
        // ⑤ Conditioning — ONLY if included, and always after everything else
        ...(includeConditioning ? [{
          title: condBlock.blockTitle,
          methodFocus: condBlock.methodFocus,
          exercises: [condBlock.ex],
        }] : []),
        // ⑥ Speed / play-style running work — split to separate home-screen card
        ...(speedWorkEx.length > 0 && !includeConditioning ? [{
          title: '🏃 Speed Work — Conditioning',
          methodFocus: 'Play-style and weakness speed work. Complete on the pitch — separate from the gym session.',
          exercises: speedWorkEx,
        }] : []),
      ],
    };
  }

  // MD-3: Structural Day — tissue architecture and fascicle length
  // Science: 2–3 sets, 5–8 reps, 70–80% 1RM, eccentric emphasis.
  // DOMS peaks at 48h — by match day (Saturday) it will be completely cleared.
  // This day is structural resilience, NOT speed. Speed day is dead — the pitch handles speed.
  if (slot.mdDay === 'MD-3') {
    const gymKey = (gymAccess as GymKey) in ECCENTRIC_BLOCK ? (gymAccess as GymKey) : 'basic';

    // Structural exercises: eccentric slider curls, single-leg RDLs — the HPP MD-3 staples
    const structuralExercises: Record<GymKey, ProgrammeExercise[]> = {
      full: [
        ex('Eccentric Slider Curl (Nordic Variation)', '3', '6', '2:30', '3–4 second eccentric lowering on the slider. This is a fascicle-length exercise — the slow eccentric under load is what lengthens the sarcomeres. DOMS will peak in 48 hours. By Saturday, it is gone. This is why we do it today.',
          { intensity: '70–80% effort', tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
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
        ex('Bodyweight Nordic Hamstring Curl (Eccentric Only)', '3', '6', '2:30', '4s eccentric lowering — fight the fall completely. Fascicle-length adaptation: sarcomeres lengthened under tension → wider operating range → reduced hamstring strain risk. DOMS peaks 48h, cleared by Saturday.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Single-Leg RDL (Bodyweight)', '3', '8 each', '2:00', '3s eccentric lowering. Touch floor with fingertips. Hamstring fascicle length at the hip hinge. Add a backpack if too easy.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Slow Eccentric Split Squat', '2', '8 each', '90s', '3s eccentric descent. Full depth. Drive through front heel. Quad fascicle adaptation.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
    };

    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: `MD-3 — ${MD3_OBJ[phase] ?? MD3_OBJ.Build}`,
      readinessNote: readinessNote + ' MD-3 structural work: eccentric DOMS peaks at 48h — by match day it is gone. This timing is deliberate.',
      durationMin: 55, fvProfile: fv.profile,
      blocks: [
        // No speed/plyometrics on MD-3 — structural day only
        {
          title: '🔥 Warm-Up (10 min)',
          methodFocus: 'Mobility and light activation — prepare joints for loaded eccentric work',
          exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 1)],
        },
        // ② Maximum Strength — structural loaded work at 70–80% with eccentric tempo
        {
          title: '💪 Maximum Strength — Structural Loading',
          methodFocus: `Loaded compound work at 70–80% 1RM with eccentric tempo. DOMS peaks at 48h. By ${slot.dayOfWeek === 'Wednesday' ? 'Saturday' : 'match day'} it will be completely gone. This is the science of smart scheduling — structural resilience built at the right time.`,
          exercises: applyReadiness(structuralExercises[gymKey], readiness.level, readiness.intensityNote),
        },
        // ③ Isometric — tendon maintenance + weakness (isometric component only)
        {
          title: '🦴 Isometric Block',
          methodFocus: 'Heavy isometric hold — maintain tendon stiffness without adding fatigue. Minimum effective dose on structural day.',
          exercises: buildIsometricBlock(gymKey),
        },
        // ④ Eccentric — always last
        {
          title: '🔴 Eccentric Block — Always Last',
          methodFocus: 'Nordic Curl and Copenhagen Plank — non-negotiable every session. Fascicle length adaptation is the primary mechanism reducing hamstring and groin strain risk. Placed last as it generates the highest structural stress.',
          exercises: ECCENTRIC_BLOCK[gymKey],
        },
        // No conditioning on MD-3
      ],
    };
  }

  // MD-2: THE FORBIDDEN ZONE — 2 days from match.
  // Objective: ZERO gym fatigue. This is the heaviest tactical/sprint day on the pitch.
  // No heavy lifting. Micro-dosed power only if needed: 2 sets × 3 reps at 30–40% 1RM, max velocity.
  if (slot.mdDay === 'MD-2') {
    const gymKey = (gymAccess as GymKey) in ECCENTRIC_BLOCK ? (gymAccess as GymKey) : 'basic';

    // Micro-dosed power: light load, maximum velocity intent. This is CNS maintenance only.
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
      objective: `MD-2 — ${MD2_OBJ[phase] ?? MD2_OBJ.Build}`,
      readinessNote: 'MD-2: THE FORBIDDEN ZONE. Do NOT lift heavy regardless of how good you feel. The pitch is the priority today. If anything, micro-dosed power only (2 sets × 3 reps, 30–40% 1RM, max velocity) — then leave. Your job today is to arrive at Saturday fresh.',
      durationMin: 30, fvProfile: fv.profile,
      blocks: [
        {
          title: '🔥 Minimal Warm-Up (8 min)',
          methodFocus: 'Light activation only — prepare for micro-dosed power work',
          exercises: [...WARMUP_MOBILITY.slice(0, 2), ...WARMUP_NEURAL.slice(0, 1)],
        },
        // ① Explosive Plyometrics — micro-dosed (MD-2 only)
        {
          title: '⚡ Explosive Plyometrics — Micro-Dosed (2 × 3 only)',
          methodFocus: 'Maximum velocity intent at 30–40% 1RM. CNS maintenance — NOT a training stimulus. 2 sets, 3 reps, full rest. Then leave. No additional volume under any circumstances.',
          exercises: microPowerEx[gymKey],
        },
        // No max strength on MD-2 (Forbidden Zone)
        // ③ Isometric only — no eccentric, no conditioning on MD-2
        {
          title: '🦴 Isometric — Pre-Match Tissue Maintenance',
          methodFocus: 'Sub-maximal isometric only — maintain hip flexor length and adductor integrity ahead of match. Not a training stimulus. Zero eccentric load today.',
          exercises: [
            ex('Isometric Hip Flexor Hold (Kneeling)', '1', '30s each side', '', 'Tall kneeling, posterior pelvic tilt. Sub-maximal hold — maintain hip flexor length ahead of match day.',
              { methodType: 'isometric', intensityIntent: 'controlled' }),
            ex('Copenhagen Plank Hold', '1', '20s each side', '', 'Adductor maintenance — sub-maximal. 20 seconds only. Protect the groin for tomorrow. No eccentric loading.',
              { methodType: 'isometric', intensityIntent: 'controlled' }),
          ],
        },
        // No eccentric on MD-2 — too close to match
        // No conditioning on MD-2
      ],
    };
  }

  // Fallback
  return primingSession(slot.dayOfWeek, position, inputs.playStyle);
}

// ── Progression note per week ──────────────────────────────────────────────

function progressNote(week: number): string {
  const hint = 'Progress both load (compounds) and sprint distances in parallel.';
  if (week <= 2) return `Record every lift and sprint — baseline data drives all future progression. ${hint}`;
  if (week <= 5) return `Add 2.5–5kg to main compounds and extend sprint volumes vs last week. 3–2 RIR.`;
  if (week <= 9) return `Push toward technical limit — 2–1 RIR. ${hint}`;
  return 'Final phase: reduce sets by 1, increase intensity. Peak expression — maximise output.';
}

// ── Conditioning session splitter ─────────────────────────────────────────
// Removes ALL conditioning/speed-work blocks from the main session and returns them
// as a standalone ProgrammeSession with its own neural warm-up on the same day.
function splitConditioningIfPresent(session: ProgrammeSession): ProgrammeSession[] {
  const condBlocks = session.blocks.filter(b =>
    b.title.toLowerCase().includes('conditioning'),
  );
  if (condBlocks.length === 0) return [session];

  const mainSession: ProgrammeSession = {
    ...session,
    blocks: session.blocks.filter(b => !b.title.toLowerCase().includes('conditioning')),
  };

  const isSpeedWork = condBlocks.every(b => b.title.toLowerCase().includes('speed work'));
  const condSession: ProgrammeSession = {
    mdDay: 'Conditioning',
    dayOfWeek: session.dayOfWeek,
    objective: isSpeedWork
      ? `Speed Session — ${condBlocks[0].exercises[0]?.name ?? 'Speed Work'}`
      : `Conditioning Session — ${condBlocks[0].exercises[0]?.name ?? 'Energy System Work'}`,
    readinessNote:
      'Complete this after your main strength session — minimum 2 hours gap. Or treat it as an evening session. Short, high-quality work.',
    durationMin: isSpeedWork ? 30 : 25,
    fvProfile: isSpeedWork
      ? 'Play-style speed & agility work. Pitch-based — no gym equipment needed.'
      : 'Aerobic / anaerobic energy system development. No strength load.',
    blocks: [
      {
        title: isSpeedWork ? '🔥 Speed Warm-Up (8 min)' : '🔥 Conditioning Warm-Up (5 min)',
        methodFocus:
          'Dynamic neural activation — prepare for high-intensity pitch work. Elevate heart rate progressively.',
        exercises: WARMUP_NEURAL,
      },
      ...condBlocks,
    ],
  };

  return [mainSession, condSession];
}

// ── Coach explanation ──────────────────────────────────────────────────────

function buildCoachExplanation(inputs: ProgrammeInputs, totalWeeks: number, readinessLevel: ReadinessLevel): string {
  const posLabels: Record<string, string> = {
    GK: 'goalkeeper', CB: 'centre back', FB: 'full back', CM: 'central midfielder', W: 'winger', ST: 'striker',
  };
  const goalLabels: Record<string, string> = {
    speed: 'speed and acceleration', strength: 'maximal strength', power: 'explosive power',
    endurance: 'endurance capacity', injury_prevention: 'injury prevention',
  };
  const fvLine = 'the full force-velocity curve — heavy strength days are paired with speed days to develop both qualities without compromising either';
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
    ? `\n\nDouble game week — Survival Mode: your schedule includes a second match day (${inputs.secondMatchDay.charAt(0).toUpperCase() + inputs.secondMatchDay.slice(1)}). When two matches fall within 4 days, the HPP rule is simple: you cannot build fitness, you can only mitigate fatigue. MD-4 and MD-3 strength blocks are completely deleted from the algorithm in double-game weeks. MD+1 becomes recovery only (isometrics + bike). MD-1 becomes neural priming only — zero heavy lifting. The pitch is the only priority. Sleep, nutrition and soft-tissue work take precedence over prescribed sets.`
    : '';

  if (inputs.offSeason) {
    return `This ${totalWeeks}-week OFF-SEASON programme is designed for a ${pos} with a primary focus on ${goal}. It covers ${fvLine}.\n\n${weaknessLine}${styleNote}\n\nOff-season mode: there are no match-day loading constraints. Every session follows the full five-block structure — Reactive Plyometrics → Explosive Plyometrics → Maximum Strength → Isometric → Eccentric. Sessions are spaced to manage DOMS and accumulated fatigue: heavy sessions are separated by at least 72 hours, with moderate sessions filling the gaps where needed.\n\nThis is the window to build physical qualities without compromise. Load can be pushed further than in-season, eccentric volume is higher, and there is no match-day to protect. Use it.\n\n${readinessLine}`;
  }

  return `This ${totalWeeks}-week programme is designed for a ${pos} with a primary focus on ${goal}. It covers ${fvLine}.\n\n${weaknessLine}${styleNote}\n\nEvery session uses a three-method structure. Concentric work builds force production, eccentric work creates structural resilience and reduces injury risk, and isometric work develops joint stability. All three are trained throughout the programme.\n\nSessions are structured around your match schedule. The heaviest training falls furthest from match day, and load is progressively reduced as the game approaches. This protects performance on the pitch while ensuring consistent physical development across the week.${doubleGameWeekNote}\n\n${readinessLine}`;
}

// ── Main export ────────────────────────────────────────────────────────────

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

  // ── Off-season path ──────────────────────────────────────────────────────
  if (inputs.offSeason) {
    const osSlots = OFF_SEASON_SCHEDULES[inputs.sessionsPerWeek] ?? OFF_SEASON_SCHEDULES[3];
    const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
      const weekNum = i + 1;
      const { phase, phaseGoal } = getPhase(weekNum, totalWeeks);
      const sessions = osSlots.flatMap(slot =>
        splitConditioningIfPresent(
          buildOffSeasonSession(slot, inputs, phase, weekNum, { level: readinessLevel, volumeMultiplier, intensityNote }),
        ),
      );
      return {
        weekNumber: weekNum,
        phase,
        phaseGoal: `${phaseGoal} [Wk ${weekNum}: ${progressNote(weekNum)}]`,
        sessions,
      };
    });
    return {
      id: `prog-${Date.now()}`,
      createdAt: Date.now(),
      title: `${pos} — ${goal} (Off Season)`,
      summary: `${totalWeeks}-week OFF-SEASON programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${inputs.sessionsPerWeek} sessions/week · No match-day loading — DOMS managed by session spacing.`,
      coachExplanation: buildCoachExplanation(inputs, totalWeeks, readinessLevel),
      readinessScore: score,
      readinessLevel,
      readinessGuidance,
      durationWeeks: totalWeeks,
      inputs,
      weeks,
    };
  }

  // ── In-season path ───────────────────────────────────────────────────────
  const slots = getMdSlots(inputs.sessionsPerWeek, inputs.matchDay);
  const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNum = i + 1;
    const { phase, phaseGoal } = getPhase(weekNum, totalWeeks);
    const sessions = slots.flatMap(slot =>
      splitConditioningIfPresent(
        buildSession(slot, inputs, phase, weekNum, { level: readinessLevel, volumeMultiplier, intensityNote }),
      ),
    );
    return {
      weekNumber: weekNum,
      phase,
      phaseGoal: `${phaseGoal} [Wk ${weekNum}: ${progressNote(weekNum)}]`,
      sessions,
    };
  });

  const matchStr = inputs.matchDay.charAt(0).toUpperCase() + inputs.matchDay.slice(1);
  const secondMatchStr = inputs.secondMatchDay
    ? ` + ${inputs.secondMatchDay.charAt(0).toUpperCase() + inputs.secondMatchDay.slice(1)}`
    : '';

  return {
    id: `prog-${Date.now()}`,
    createdAt: Date.now(),
    title: `${pos} — ${goal}`,
    summary: `${totalWeeks}-week personalised programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${inputs.sessionsPerWeek} sessions/week · Match day: ${matchStr}${secondMatchStr}${inputs.secondMatchDay ? ' (double game weeks accounted for)' : ''}.`,
    coachExplanation: buildCoachExplanation(inputs, totalWeeks, readinessLevel),
    readinessScore: score,
    readinessLevel,
    readinessGuidance,
    durationWeeks: totalWeeks,
    inputs,
    weeks,
  };
}
