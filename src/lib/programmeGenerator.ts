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
    { dayOfWeek: 'Saturday', load: 'heavy' },  // 96h gap — full recovery, uses weekend
  ],
  3: [
    { dayOfWeek: 'Monday',   load: 'heavy' },
    { dayOfWeek: 'Wednesday', load: 'moderate' }, // 48h — moderate to manage DOMS
    { dayOfWeek: 'Saturday', load: 'heavy' },     // 72h — fully recovered, uses weekend
  ],
  4: [
    { dayOfWeek: 'Monday',   load: 'heavy' },
    { dayOfWeek: 'Wednesday', load: 'moderate' }, // 48h — moderate, no consecutive heavy
    { dayOfWeek: 'Friday',   load: 'heavy' },     // 48h — recovered from Wed
    { dayOfWeek: 'Sunday',   load: 'moderate' },  // 48h — moderate, uses weekend, no double day
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
    ex('Short HIIT Intervals — Foundation', '8', '30s hard · 30s rest', '—',
      '8 reps of 30s at 95–100% HRmax + 30s rest. After each rep, slowly jog back to the start — rest for any remaining seconds. Near-maximal effort every rep: as fast as you can sustain for 30s. Total hard work: 4 minutes. Evidence: Wisloff et al. (2007) — short supramaximal intervals drive VO₂max in less-trained athletes.',
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
    ex('40/20 HIIT Protocol', '10', '40s @ 110% MAS · 20s rest', '—',
      '10 reps of 40s at 110% MAS + 20s rest. After each rep, slowly jog back to the start — rest for any remaining seconds. Longer work period than 15/15 builds lactate tolerance alongside VO₂max. Evidence: Buchheit & Laursen (2013) — 40/20 at 110% MAS extends the high-intensity stimulus window compared to shorter protocols while keeping total fatigue manageable.',
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
  const osDayIdx = DAY_SEED[slot.dayOfWeek] ?? 0;
  const osSessionSeed = weekNum * 7 + osDayIdx;
  const allPlayStyleRunning = (PLAY_STYLE_RUNNING[inputs.playStyle] ?? []).filter(e => e.isRunning);
  const playStyleRunning = allPlayStyleRunning.length > 0
    ? [allPlayStyleRunning[osSessionSeed % allPlayStyleRunning.length]]
    : [];
  const allWeaknessRunning = weaknessEx.filter(e => e.isRunning);
  const weaknessRunning = allWeaknessRunning.length > 0
    ? [allWeaknessRunning[osSessionSeed % allWeaknessRunning.length]]
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
    const md4DayIdx = DAY_SEED[slot.dayOfWeek] ?? 0;
    const md4SessionSeed = weekNum * 7 + md4DayIdx;
    const allPlayStyleRunning = (PLAY_STYLE_RUNNING[inputs.playStyle] ?? []).filter(e => e.isRunning);
    const playStyleRunning = allPlayStyleRunning.length > 0
      ? [allPlayStyleRunning[md4SessionSeed % allPlayStyleRunning.length]]
      : [];
    const allWeaknessRunning = weaknessEx.filter(e => e.isRunning);
    const weaknessRunning = allWeaknessRunning.length > 0
      ? [allWeaknessRunning[md4SessionSeed % allWeaknessRunning.length]]
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
