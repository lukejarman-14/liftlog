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
  const raw = (r.sleep + (6 - r.fatigue) + (6 - r.soreness) + (6 - r.stress)) / 4;
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
  ex('Ankle Circles + Eccentric Calf Raise', '1', '10 each direction', '', 'Full dorsiflexion range. 3s lowering on the calf.',
    { methodType: 'eccentric', intensityIntent: 'controlled', tempo: '3-0-1-0' }),
  ex('Goblet Squat (Bodyweight)', '2', '10', '30s', 'Elbows inside knees at the bottom. Drive knees out. Full depth.',
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
        ex('Pistol Squat (Box)', '2', '4 @ 2 RIR', '2:30', 'Box for depth reference. 2 RIR — 2 reps from failure. Controlled. With bodyweight, RIR is the intensity variable.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Single-Leg Hip Thrust', '2', '8 each', '90s', 'Full hip extension. If 8 reps feels easy, go to failure on the last set.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
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
        ex('Pistol Squat', '2', '4 @ 2 RIR', '2:30', 'Controlled descent. Explosive drive up. 2 RIR.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Single-Leg Hip Thrust', '2', '8 each', '2:00', 'Full hip extension. Go to failure on last set if comfortable.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
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
        ex('Pistol Squat', '2', '4 @ 2 RIR', '2:30', 'Controlled descent. Explosive drive up. 2 RIR.',
          { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Single-Leg Hip Thrust', '2', '8 each', '2:00', 'Full hip extension. Go to failure on last set if comfortable.',
          { tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
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

// ── Max Velocity Block — sprinting & jumping FIRST (fresh CNS required) ────
// Science: max velocity sprinting and jumping require a completely fresh nervous system.
// Always immediately after warm-up, BEFORE any heavy strength work.
// No weighted exercises — sprints and jumps only.

const POWER_PRIMER: Record<GymKey, ProgrammeExercise[]> = {
  full: [
    ex('Broad Jump', '3', '4', '3:00', 'Max horizontal displacement. Swing arms. Drive through the hips. Stick the landing. Full reset between reps — this is neural output, not conditioning.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Box Jump', '2', '4', '2:30', 'Step back, drive arms, explode onto the box. Land softly in a partial squat. Step down — do not jump down. Full reset between reps.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  basic: [
    ex('Broad Jump', '3', '4', '2:30', 'Max horizontal displacement. Swing arms. Stick landing. Full reset between reps — this is neural output, not conditioning.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Box Jump', '2', '4', '2:30', 'Step back, drive arms, explode onto the box. Land softly in a partial squat. Step down — do not jump down. Full reset between reps.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  none: [
    ex('Countermovement Jump', '3', '4', '2:30', 'Arms back, deep dip, drive through ceiling. Max height. 30s between reps — this is neural output, not conditioning.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Broad Jump', '2', '4', '2:30', 'Max horizontal displacement. Swing arms. Stick the landing. Full reset.',
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
    ex('Isometric Split Squat Hold (Heavy)', '3', '45s each leg', '2:00', 'Bottom of split squat — rear knee 2cm from floor. Add load via barbell or heavy DB. Maximum effort throughout — zero relaxing. Patellar tendon HSR: the tendon stiffens under this load so the quadriceps muscle doesn\'t overwork during sprint deceleration.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold (Heel Raise Position)', '3', '45s each leg', '2:00', 'Rise onto single-leg tiptoe. Hold at the top. Add weight via DB or barbell if available. Maximum effort. Achilles tendon HSR — stiffness adaptation. The tendon absorbs sprint push-off load so the calf muscle doesn\'t overwork over 90 minutes.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'Ankles STIFF — no dorsiflexion. Arms punch up. Minimum ground contact time. This is tendon-spring training at match-speed loading rate. Different stimulus from the holds above — the holds build stiffness; pogos train the SSC elastic return.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  basic: [
    ex('Isometric Split Squat Hold (Heavy DB)', '3', '45s each leg', '2:00', 'Bottom of split squat. Hold heaviest available DB. Maximum effort throughout. Patellar tendon HSR — the tendon stiffens under heavy isometric load so it handles sprint/jump demand instead of the muscle.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold', '3', '45s each leg', '2:00', 'Single-leg tiptoe hold. Hold heavy DB at side. Maximum effort. Achilles tendon HSR. The stiffer the tendon, the more it acts as a spring — reducing muscle work over the full 90 minutes.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'Stiff ankles. Fast ground contacts. Elastic tendon return — train the spring.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  none: [
    ex('Single-Leg Isometric Wall Sit', '3', '45s each leg', '2:00', 'Single-leg at 60° knee flexion against wall. Back flat. Maximum effort. Patellar tendon HSR at 60° is the clinically-validated loading angle — heavy isometric at this position directly increases patellar tendon stiffness.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Single-Leg Calf Isometric Hold', '3', '45s each leg', '2:00', 'Rise onto single-leg tiptoe. Hold maximum effort. Achilles HSR — tendon absorbs sprint load so calf muscle capacity is preserved.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Pogo Hops', '3', '20', '90s', 'Ankles stiff. Minimum ground contact. Elastic SSC tendon return.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
};

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
    ex('Copenhagen Plank', '2', '25s each side', '90s', 'Top foot on bench, bottom leg free. Adductor eccentric — groin strain prevention. Most evidenced single exercise for groin protection in football. Build hold time by 5s each week.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
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
      ex('DB Bench Press', '3', '10', '2:00', 'Retract shoulder blades. Controlled descent. Explosive push.',
        { intensity: '60% effort', tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('DB Row', '3', '10', '2:00', 'Hinge 45°. Pull elbow to hip. Squeeze lat at top.',
        { tempo: '2-1-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('DB Shoulder Press', '3', '10', '90s', 'Neutral spine. No arching. Full lockout overhead.',
        { intensity: 'Moderate', methodType: 'concentric', intensityIntent: 'moderate' }),
    ],
    basic: [
      ex('DB Bench Press', '3', '10', '2:00', 'Retract shoulder blades. Controlled descent. Explosive push. DBs allow free range — use them.',
        { intensity: '60% effort', tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('Barbell Bent-Over Row', '3', '8', '2:00', 'Hinge at 45°. Pull bar to lower chest. Squeeze lats at top. Control the descent.',
        { intensity: 'Moderate', tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('DB Shoulder Press', '3', '10', '90s', 'Neutral spine. No arching. Full lockout overhead.',
        { intensity: 'Moderate', methodType: 'concentric', intensityIntent: 'moderate' }),
    ],
    none: [
      ex('Push-Up', '3', '10', '90s', 'Hands just outside shoulders. Full lockout. Lower chest to within 3cm of floor. Bodyweight horizontal push.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('Inverted Row (Table or Low Bar)', '3', '8', '90s', 'Lie under table/low bar. Pull chest to bar. Heels on floor. Straight body throughout. Bodyweight horizontal pull — no equipment needed beyond a stable surface.',
        { tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ex('Pike Push-Up', '3', '8', '90s', 'Hips high, forming an inverted V. Lower head toward floor. Vertical push pattern — shoulder stimulus without overhead equipment.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'moderate' }),
    ],
  },
  Build: {
    full: [
      ex('Bench Press', '4', '5', '3:00', 'Explosive push. 2s controlled descent. Just outside shoulder-width.',
        { intensity: '75% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ex('Weighted Pull-Up', '4', '4', '3:00', 'Dead hang to chin over bar. Initiate with lats.',
        { intensity: 'Add 5–10kg', tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ex('Push Press', '3', '4', '2:30', 'Dip and drive hips. Aggressive lockout. Bar over heels.',
        { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '3', '5', '3:00', 'Explosive push. 2s controlled descent. Just outside shoulder-width. Barbell allows heavier load than DBs.',
        { intensity: '75% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ex('Barbell Bent-Over Row', '3', '5', '2:30', 'Hinge at 45°. Pull bar to lower chest explosively. Horizontal pull for upper back strength.',
        { intensity: '75% 1RM', tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ex('DB Push Press', '3', '5', '2:30', 'Dip and drive hips — DBs allow bilateral or unilateral variation. Aggressive lockout overhead.',
        { intensity: 'Moderate-heavy', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Plyometric Push-Up', '3', '6', '2:30', 'Explosive push — hands leave the floor at the top. Land softly. Bodyweight upper power development.',
        { tempo: '2-0-x-0', methodType: 'reactive', intensityIntent: 'explosive' }),
      ex('Inverted Row (Table or Low Bar)', '3', '8', '2:00', 'Pull chest to bar, heels on floor, body straight throughout. Add difficulty by elevating feet.',
        { tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
      ex('Pike Push-Up', '3', '8', '2:00', 'Hips high, inverted V. Lower head toward floor between hands. Vertical push — shoulder development.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ],
  },
  'Strength & Power': {
    full: [
      ex('Bench Press', '4', '3', '3:30', 'Maximum force intent.',
        { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '4', '3', '3:00', '1s pause at top. 3s descent. No kipping.',
        { intensity: 'Challenging', tempo: '1-1-x-3', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '4', '90s', 'Dip and drive hips aggressively. Lockout at full extension. Maximum rate of force development.',
        { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '3', '4', '3:30', 'Maximum force intent. Bar moves fast on every rep.',
        { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Bent-Over Row', '3', '4', '3:00', 'Pull bar to lower chest with intent. Control descent. Heavy horizontal pull.',
        { intensity: '80% 1RM', tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('DB Push Press', '3', '4', '2:30', 'Dip and drive hips. Explosive lockout. Maximum rate of force development.',
        { intensity: 'Heavy DB', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    none: [
      ex('Archer Push-Up', '3', '5 each side', '3:00', 'Wide hands. Lower to one side — that arm takes full load. Alternate sides. Unilateral bodyweight strength — progressively harder than standard push-up.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Inverted Row (Feet Elevated)', '3', '6', '2:30', 'Pull chest to bar with feet elevated on chair. High difficulty — close to body row. Maximal bodyweight horizontal pull.',
        { tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Pike Push-Up (Deficit)', '3', '6', '2:00', 'Hands on elevated surface (books, bags). Increase depth below hand level. Harder vertical push pattern.',
        { tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ],
  },
  Peak: {
    full: [
      ex('Bench Press', '3', '2', '4:00', 'Max intent. Full recovery.',
        { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Weighted Pull-Up', '3', '3', '4:00', 'Explosive concentric. Full recovery.',
        { intensity: 'Heavy', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Push Press', '3', '3', '2:00', 'Explosive dip and drive. Express upper body rate of force development at peak intensity.',
        { intensity: '80% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
    ],
    basic: [
      ex('Barbell Bench Press', '2', '3', '4:00', 'Max intent. Full recovery. Express peak upper strength.',
        { intensity: '88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ex('Barbell Bent-Over Row', '2', '3', '3:30', 'Peak horizontal pull. Maximum intent. Full rest.',
        { intensity: '85% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ],
    none: [
      ex('Explosive Push-Up', '2', '5 @ 1 RIR', '3:00', 'Maximum explosive intent on every rep. 1 RIR — close to failure. Bodyweight peak upper expression.',
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

const PLAY_STYLE_EX: Record<string, ProgrammeExercise[]> = {
  'box-to-box': [
    ex('45s AMRAP (Goblet Squat + Lateral Jump + Sprint 10m)', '4', '45s on / 45s off', '45s', 'Simulate box-to-box demands. Quality through fatigue.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
  ],
  'direct': [
    ex('Sprint + Controlled Decel + Sprint', '4', '20m + stop + 20m', '3:00', 'Direct play demands. Burst, brake, repeat.',
      { methodType: 'eccentric', intensityIntent: 'maximal' }),
  ],
  'technical': [
    ex('Lateral Bound + Balance Hold', '3', '5 each', '2:00', 'Multi-directional agility. Stable landing = technical foundation.',
      { methodType: 'reactive', intensityIntent: 'controlled' }),
  ],
  'physical': [
    ex('Isometric Split Squat Hold', '3', '45s each', '2:00', 'Bottom position hold. Physical duel strength and joint integrity.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
  ],
  'press-heavy': [
    ex('Short Sprint + Recovery Jog Circuit', '5', '10m sprint / 20m jog', 'Continuous', 'Simulate press trigger and recovery. Press-heavy demands.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
  ],
  'counter-attack': [
    ex('Acceleration from Set Position', '5', '30m', '3:00', 'From standing or jogging — explosive transition to sprint. Counter-attack simulation.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
  ],
};

// ── Conditioning by position × phase ──────────────────────────────────────

// Running-based conditioning — MD-2 uses CONDITIONING_MD2 (low-impact bike/pool).
// This table provides the run-based exercises for standalone conditioning sessions
// and is consumed by getRunCondEx() below.
const CONDITIONING: Record<PosKey, Record<string, ProgrammeExercise>> = {
  GK: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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
  },

  CB: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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
  },

  FB: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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
  },

  CM: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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
  },

  W: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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
  },

  ST: {
    Foundation: ex(
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

    Build: ex(
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

    'Strength & Power': ex(
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

    Peak: ex(
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

/** Returns run-based conditioning for a position/phase (for reference / future standalone sessions). */
export function getRunCondEx(posKey: PosKey, phase: string): ProgrammeExercise {
  return CONDITIONING[posKey]?.[phase] ?? CONDITIONING.CM.Foundation;
}

// ── Weakness exercises ─────────────────────────────────────────────────────

const WEAKNESS_EX: Record<string, ProgrammeExercise[]> = {
  speed: [
    ex('Hip Flexor Sprint Drill', '3', '4 × 20m', '2:00', 'Rapid knee drive. Arms drive speed.',
      { methodType: 'concentric', intensityIntent: 'explosive' }),
    ex('Single-Leg Broad Jump', '3', '5 each', '2:00', 'Push horizontally off one foot. Land controlled. Max distance.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
    ex('Single-Leg Hip Thrust (Glute Focus)', '2', '10 each', '90s', 'Shoulders on bench, non-working leg raised. Full hip extension. Squeeze at top. Glute/hamstring motor units — horizontal force without any equipment beyond a bench or low surface.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
  ],
  strength: [
    // Concentric strength work only — eccentrics belong in the Eccentric block.
    // These go at the END of the Maximum Strength block, after vertical + horizontal compound lifts.
    ex('Paused Squat', '2', '3', '3:00', '2s pause at bottom — maintain tension. Explosive up. Complements the main compound lift. 2 sets only: supplemental, not the priority.',
      { intensity: '75% 1RM', tempo: '1-2-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Isometric Split Squat Hold', '1', '40s each', '2:00', 'Bottom position hold. Tendon stiffness and joint stability. 1 set — maintenance dose at the end of the strength block.',
      { tempo: '0-40s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
  ],
  endurance: [
    ex('Aerobic Threshold Run', '1', '20 min', '', '70% max HR — truly conversational pace. Aerobic base.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    ex('Cardiac Output Circuit', '3', '5 min', '90s rest', '1 min jog / 1 min bike / 1 min row / 1 min step / 1 min jump rope. HR 130–150.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
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
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('T-Drill', '3', 'Full drill', '2:30', 'Sprint, shuffle left, shuffle right, back-pedal. Precise footwork at each cone.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    ex('Reactive Cone Drill (Partner)', '4', '6 reps', '2:00', 'Partner signals direction. React and accelerate. Decision speed is the variable.',
      { methodType: 'reactive', intensityIntent: 'reactive' }),
  ],
  injury_prone: [
    // Low volume, non-eccentric — Nordics/Copenhagen already in ECCENTRIC_BLOCK every session.
    // This is maintenance/proprioception only: 1 set, placed at the END of the session.
    ex('Single-Leg Balance Reach', '1', '8 each', '45s', 'Reach forward, lateral, diagonal. Ankle stability and proprioception. 1 set — enough stimulus for neural adaptation without adding fatigue.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Isometric Split Squat Hold (Light)', '1', '20s each leg', '60s', 'Bottom position, bodyweight or very light load only. Joint awareness and tendon maintenance. 1 set — minimum effective dose. This is not a strength exercise.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
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
    ex('Single-Leg Balance (Eyes Closed)', '3', '40s each', '60s', 'Slight knee bend. Eyes closed when easy. Proprioception training. No equipment needed.',
      { tempo: '0-40s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Ankle Dorsiflexion Mob (Kneeling)', '2', '10 each', '30s', 'Kneeling lunge position. Drive knee forward over pinky toe — keep heel on floor. Rock forward and back. Restore full dorsiflexion range. No equipment needed.',
      { methodType: 'mixed', intensityIntent: 'controlled' }),
  ],
  knee: [
    ex('Isometric Wall Sit — Single-Leg at 60°', '3', '45s each', '2:00', '60° knee flexion against wall — single leg. Maximum effort. This is the clinically-validated patellar tendon HSR angle: heavy isometric at 60° directly increases patellar tendon stiffness. The tendon then absorbs more landing/deceleration load so the quad muscle doesn\'t overwork.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
    ex('Eccentric Step-Down (4s Lower)', '3', '8 each', '90s', '4s single-leg descent. Knee tracks over second toe. Eccentric quad loading — increases fascicle length. Longer fascicles = individual sarcomeres tolerate more stretch before failure.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  groin: [
    ex('Copenhagen Plank — Eccentric Lower', '3', '6 each side', '2:00', 'Start with hips elevated, top foot on bench. Slowly lower hips over 4s — feel the adductor lengthen eccentrically under load. Return to top. Eccentric variant drives fascicle length adaptation in the adductor, reducing groin strain risk at full stride.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Copenhagen Plank — Isometric Hold', '2', '25s each side', '90s', 'Top foot on bench. Hold with maximum adductor effort. Groin prevention — isometric complements the eccentric above.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  calf: [
    ex('Alfredson Eccentric Calf Protocol', '3', '15', '90s', 'Raise with both, lower on single leg over 3s. Knee straight for gastrocnemius, then repeat with knee bent for soleus. Eccentric loading increases fascicle length AND tendon capacity. If symptomatic (Achilles pain), perform 3×15 twice daily.',
      { tempo: '3-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Heavy Single-Leg Calf Isometric Hold', '3', '45s each', '90s', 'Rise onto single-leg tiptoe. Hold maximum effort — add weight via DB if possible. Achilles tendon HSR: heavy slow resistance increases tendon stiffness so the tendon (not the calf muscle) absorbs the sprint push-off load.',
      { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'maximal' }),
  ],
  back: [
    ex('Dead Bug', '3', '6 each side', '60s', 'Lower back into floor throughout. Extend opposite arm and leg — do not lose lumbar contact. Anti-extension core stability. No equipment needed.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Side Plank', '3', '30s each side', '60s', 'Elbow under shoulder. Hips stacked. Anti-lateral flexion — protects the lumbar spine under rotation load. No equipment needed.',
      { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  shoulder: [
    ex('Side-Lying External Rotation', '3', '15 each', '60s', 'Lie on side. Elbow pinned at 90°. Rotate forearm upward slowly — 2s up, 2s down. Rotator cuff activation. No equipment needed.',
      { tempo: '2-0-2-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Prone T-Y-W (Scapular Control)', '3', '8 each shape', '60s', 'Lie face down. T: arms wide, thumbs up. Y: arms at 45°. W: elbows bent 90°, pull back. Squeeze shoulder blades on each. No equipment needed.',
      { methodType: 'concentric', intensityIntent: 'controlled' }),
  ],
};

// Note: Nordics and Copenhagen Plank are in ECCENTRIC_BLOCK (always last in session).
// DEFAULT_PREHAB covers position-agnostic stability work for athletes with no specific injury history.
const DEFAULT_PREHAB: ProgrammeExercise[] = [
  ex('Single-Leg Balance (Eyes Closed)', '2', '40s each', '60s', 'Slight knee bend. Eyes closed when stable. Ankle and knee proprioception — foundational for every footballer. No equipment needed.',
    { tempo: '0-40s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
  ex('Dead Bug', '2', '8 each side', '60s', 'Lower back pressed into floor throughout. Extend opposite arm and leg simultaneously — do not lose lumbar contact. Anti-extension core stability. No equipment needed.',
    { methodType: 'isometric', intensityIntent: 'controlled' }),
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
          ex('Single-Leg Glute Bridge Hold', '2', '45s each side', '60s', 'Shoulders on floor, hips extended, squeeze glute. RPE 3–4 — this is analgesia, not strength training. Breathe steadily. The goal is blood flow and pain reduction, not force production.',
            { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Wall Sit (Bilateral)', '2', '45s', '60s', 'Back flat against wall. Knees at 90°. RPE 3–4. Quadriceps isometric hold — reduces muscle soreness without adding eccentric damage. Breathe steadily throughout.',
            { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Prone Hamstring Isometric Hold', '2', '45s each side', '60s', 'Face down, ankle hooked under a fixed surface. Pull heel toward glute and hold. RPE 3–4. Hamstring isometric at mid-length — reduces DOMS without the eccentric loading that would add more micro-damage.',
            { tempo: '0-45s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '🔄 Hip & Ankle Mobility',
        methodFocus: 'Restore range of motion — gentle, non-fatiguing. Match soreness reduces ROM; restore it slowly.',
        exercises: [
          ex('Hip 90/90 Mobilisation', '1', '60s each side', '', 'Breathe into end range. Never force it. Restore hip ROM lost from match day.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Supine Knee Hug + Ankle Circle', '1', '30s each side', '', 'Pull knee to chest. Circle ankle through full range. Light and parasympathetic.',
            { methodType: 'mixed', intensityIntent: 'controlled' }),
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
  void (CONDITIONING[posKey]?.[phase] ?? CONDITIONING.CM.Foundation);
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
  // 1. Speed & Plyometrics  (fresh CNS — jumps, sprints, reactive)
  // 2. Maximum Strength      (heavy compound, upper body, play style, weakness)
  // 3. Isometric             (tendon HSR holds, prehab isometrics)
  // 4. Eccentric             (Nordics, Copenhagen, sliders — most structural stress, always last)
  // 5. Conditioning          (only when included — always after everything else)

  if (slot.mdDay === 'MD-4') {
    const gymKey = (gymAccess as GymKey) in POWER_PRIMER ? (gymAccess as GymKey) : 'basic';

    // Split TENDON_SSC_BLOCK: first 2 entries = isometric holds → Isometric block
    // Last entry = pogo hops (reactive) → Speed & Plyometrics block
    const tendonIsometrics = TENDON_SSC_BLOCK[gymKey].slice(0, 2);
    const pogoHops = TENDON_SSC_BLOCK[gymKey].slice(2);

    // Conditioning — only for endurance-focused athletes, placed LAST
    const includeConditioning = inputs.primaryGoal === 'endurance' || inputs.biggestWeakness === 'endurance';
    const condEx = CONDITIONING[position as PosKey]?.[phase] ?? CONDITIONING.CM[phase];

    // Prehab: isometric exercises only (filter out eccentric prehab — it moves to eccentric block)
    const prehabIsometric = prehabEx.filter(e => e.methodType === 'isometric' || !e.methodType);
    const prehabEccentric = prehabEx.filter(e => e.methodType === 'eccentric');

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
        // ① Speed & Plyometrics — FIRST
        {
          title: '⚡ Speed & Plyometrics',
          methodFocus: 'ALWAYS first — sprinting, jumping and reactive work require a completely fresh nervous system. Full rest between reps. This is neural output, not conditioning.',
          exercises: [...POWER_PRIMER[gymKey], ...pogoHops],
        },
        // ② Maximum Strength — strict order: vertical → horizontal → accessory → weakness LAST
        // NO eccentric exercises in this block — they go to block ④ only.
        {
          title: '💪 Maximum Strength',
          methodFocus: fv.loadScheme === 'heavy'
            ? 'Maximal force — 85%+ load, low reps, explosive concentric intent. Order: heavy vertical compound → heavy horizontal → upper accessory → play-style and weakness work last. Bar velocity is your autoregulation signal. Zero eccentric work in this block.'
            : 'Strength-speed — high load with explosive intent. Heavy vertical compound first, then horizontal, then accessory. Weakness work always last. No eccentric exercises here.',
          exercises: applyReadiness(
            [
              // 1. Heavy vertical (hip hinge, squat) — the main compound lift, first
              ...strengthEx,
              // 2. Heavy horizontal (upper push/pull) — second
              ...upperEx.slice(0, 2),
              // 3. Play style — third
              ...(playStyleEx.filter(e => e.methodType !== 'eccentric')),
              // 4. Weakness — LAST, and only concentric/isometric (no eccentric)
              ...(biggestWeakness !== 'endurance'
                ? weaknessEx.filter(e => e.methodType !== 'eccentric')
                : []),
            ],
            readiness.level,
            readiness.intensityNote,
          ),
        },
        // ③ Isometric — after strength, before eccentric
        {
          title: '🦴 Isometric Block',
          methodFocus: 'Heavy isometric holds — tendon stiffness adaptation (HSR protocol). Maximum effort throughout each hold. The tendon stiffens under heavy isometric load so it absorbs sprint/jump force instead of the muscle.',
          exercises: [
            ...tendonIsometrics,
            ...(prehabIsometric.length > 0 ? prehabIsometric : DEFAULT_PREHAB),
          ],
        },
        // ④ Eccentric — ALWAYS last (before conditioning only)
        {
          title: '🔴 Eccentric Block — Always Last',
          methodFocus: 'Eccentric work placed LAST because it generates the most structural stress and residual DOMS. Nordic Curl fascicle-length adaptation is the primary hamstring strain prevention mechanism. Non-negotiable.',
          exercises: [...ECCENTRIC_BLOCK[gymKey], ...prehabEccentric],
        },
        // ⑤ Conditioning — ONLY if included, and always after everything else
        ...(includeConditioning && condEx ? [{
          title: '🏃 Conditioning — Always Last',
          methodFocus: 'Conditioning completed LAST — after all strength and structural work. Energy system development without compromising quality of strength and eccentric stimulus.',
          exercises: [condEx],
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
          exercises: [
            TENDON_SSC_BLOCK[gymKey][0],
            ...(weaknessEx.slice(0, 1).filter(e => e.methodType === 'isometric')),
          ],
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
        // ① Speed & Plyometrics — micro-dosed (jumps = plyometric; first block per rule)
        {
          title: '⚡ Speed & Plyometrics — Micro-Dosed (2 × 3 only)',
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

  return `This ${totalWeeks}-week programme is designed for a ${pos} with a primary focus on ${goal}. It covers ${fvLine}.\n\n${weaknessLine}${styleNote}\n\nEvery session uses a three-method structure. Concentric work builds force production, eccentric work creates structural resilience and reduces injury risk, and isometric work develops joint stability. All three are trained throughout the programme.\n\nSessions are structured around your match schedule. The heaviest training falls furthest from match day, and load is progressively reduced as the game approaches. This protects performance on the pitch while ensuring consistent physical development across the week.${doubleGameWeekNote}\n\n${readinessLine}`;
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateProgramme(inputs: ProgrammeInputs): GeneratedProgramme {
  const { score, level: readinessLevel, guidance: readinessGuidance, volumeMultiplier, intensityNote } = calcReadiness(inputs.readiness);
  const totalWeeks = durationWeeks(inputs.experienceYears);
  const slots = getMdSlots(inputs.sessionsPerWeek, inputs.matchDay);

  const POSITION_LABELS: Record<string, string> = {
    GK: 'Goalkeeper', CB: 'Centre Back', FB: 'Full Back', CM: 'Midfielder', W: 'Winger', ST: 'Striker',
  };
  const GOAL_LABELS: Record<string, string> = {
    speed: 'Speed & Acceleration', strength: 'Strength', power: 'Explosive Power',
    endurance: 'Endurance', injury_prevention: 'Injury Prevention',
  };
  const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNum = i + 1;
    const { phase, phaseGoal } = getPhase(weekNum, totalWeeks);
    const sessions = slots.map(slot =>
      buildSession(slot, inputs, phase, weekNum, { level: readinessLevel, volumeMultiplier, intensityNote }),
    );
    return {
      weekNumber: weekNum,
      phase,
      phaseGoal: `${phaseGoal} [Wk ${weekNum}: ${progressNote(weekNum)}]`,
      sessions,
    };
  });

  const pos = POSITION_LABELS[inputs.position] ?? inputs.position;
  const goal = GOAL_LABELS[inputs.primaryGoal] ?? inputs.primaryGoal;
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
