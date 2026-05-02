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
      guidance: 'Moderate readiness. Complete the program — reduce load by ~10% on main compounds. Monitor RPE and back off if effort spikes unexpectedly.',
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
    profile: 'Speed day. Light load, maximal velocity. Quality over quantity.',
    loadScheme: 'light', repRange: 'high',
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
  ex('Lateral Band Walk', '2', '15 steps each way', '30s', 'Feet hip-width. Constant band tension. Knees track over toes.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
  ex('A-Skip', '2', '2 × 20m', '30s', 'Knee to hip height. Claw foot back down. Tall posture, relaxed shoulders.',
    { intensityIntent: 'moderate' }),
  ex('High Knees', '2', '20m', '20s', 'Punch knees fast. Land ball of foot. Rapid arm action.',
    { intensityIntent: 'moderate' }),
];

const WARMUP_SPEED = [
  ex('Butt Kicks', '2', '20m', '20s', 'Heel to glute. Hips tall — no forward hinge.',
    { intensityIntent: 'moderate' }),
  ex('Build-Up Sprint 60→80→90%', '3', '30m', '60s', 'Smooth ramp. Feel rhythm build. No flying start.',
    { intensityIntent: 'submaximal' }),
];

const WARMUP_STRENGTH = [
  ex('Ankle Circles + Eccentric Calf Raise', '1', '10 each direction', '', 'Full dorsiflexion range. 3s lowering on the calf.',
    { methodType: 'eccentric', intensityIntent: 'controlled', tempo: '3-0-1-0' }),
  ex('Goblet Squat (Bodyweight)', '2', '10', '30s', 'Elbows inside knees at the bottom. Drive knees out. Full depth.',
    { methodType: 'concentric', intensityIntent: 'controlled', tempo: '3-0-1-0' }),
  ex('Band Pull-Apart', '2', '15', '20s', 'Retract scapulae. Thumbs pointing back at full range.',
    { methodType: 'concentric', intensityIntent: 'moderate' }),
];

// ── Strength library — by phase × gym access × load scheme ────────────────

type GymKey = 'full' | 'basic' | 'none';
type LoadKey = 'heavy' | 'moderate';

const STRENGTH_LIBRARY: Record<string, Record<GymKey, Record<LoadKey, ProgrammeExercise[]>>> = {
  Foundation: {
    full: {
      heavy: [
        ex('Back Squat', '4', '6', '3:00', 'Bar high on traps. Controlled 3s descent. Explosive drive from the hole.',
          { intensity: '70% 1RM', tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Romanian Deadlift', '3', '8', '2:00', 'Hinge at hip with soft knees. Feel hamstring tension load. Bar close to body.',
          { intensity: '60% 1RM', tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Dumbbell Split Squat', '3', '8 each', '90s', 'Front shin vertical. Drive through heel. Rear knee skims the floor.',
          { tempo: '2-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      moderate: [
        ex('Back Squat', '3', '8', '2:30', 'Full depth. 3s descent. Consistent bar path each rep.',
          { intensity: '65% 1RM', tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
        ex('Romanian Deadlift', '3', '10', '2:00', 'Hinge deep. Neutral spine throughout. Hamstring-led.',
          { intensity: '55% 1RM', tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Dumbbell Split Squat', '3', '10 each', '90s', 'Long stance. Control the descent.',
          { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
    },
    basic: {
      heavy: [
        ex('Goblet Squat', '4', '8', '2:30', 'Full depth. Drive knees out. 3s descent.',
          { tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Single-Leg Romanian Deadlift', '3', '8 each', '90s', 'Load the standing hip. Neutral spine. Reach back foot for balance.',
          { tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Reverse Lunge (Heavy DB)', '3', '8 each', '90s', 'Long step back. Rear knee near floor. Drive front heel to stand.',
          { tempo: '2-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      moderate: [
        ex('Goblet Squat', '3', '10', '2:00', 'Full depth. 3s descent. Chest tall.',
          { tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
        ex('Single-Leg RDL', '3', '10 each', '90s', 'Reach forward. Flat back. Feel the hamstring.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'moderate' }),
        ex('DB Walking Lunge', '3', '12 each', '90s', 'Long stride. Front knee tracks over second toe.',
          { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat Progression (Box)', '3', '6 each', '2:00', 'Low box. Drive heel into surface. No collapse.',
          { tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Single-Leg RDL (Bodyweight)', '3', '10 each', '90s', 'Arms forward as counterbalance. Slow and controlled.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Walking Lunge', '3', '12 each', '90s', 'Long stride. Drive tall at the top.',
          { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
      moderate: [
        ex('Pistol Squat Progression', '3', '8 each', '2:00', 'Box support if needed. Controlled descent.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'moderate' }),
        ex('Single-Leg RDL (BW)', '3', '12 each', '90s', 'Slow and deliberate. Feel the hip hinge.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'moderate' }),
        ex('Nordic Hamstring Curl', '3', '4', '3:00', 'Fight the fall. 4s eccentric. Catch at 45°.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
    },
  },
  Build: {
    full: {
      heavy: [
        ex('Back Squat', '4', '5', '3:30', 'Brace hard. Hit depth. Accelerate through sticking point aggressively.',
          { intensity: '78% 1RM', tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Trap Bar Deadlift', '4', '4', '3:30', 'Optimal hip position. Drive the floor away. Hips and knees lock simultaneously.',
          { intensity: '80% 1RM', tempo: '1-0-1-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Bulgarian Split Squat', '3', '5 each', '2:30', 'Rear foot elevated. Vertical torso. Drive front heel with intent.',
          { intensity: 'Heavy DB', tempo: '2-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      moderate: [
        ex('Back Squat', '3', '6', '3:00', 'Consistent depth. Controlled descent. Explosive up.',
          { intensity: '72% 1RM', tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Trap Bar Deadlift', '3', '5', '3:00', 'Flat back. Drive floor away. Smooth bar path.',
          { intensity: '72% 1RM', tempo: '1-0-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
        ex('Bulgarian Split Squat', '3', '6 each', '2:00', 'Drive through heel. Rear knee doesn\'t touch floor on the way up.',
          { intensity: 'Moderate DB', tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
    },
    basic: {
      heavy: [
        ex('DB Hang Clean + Press', '4', '4', '3:00', 'Hinge and pull. High elbows. Press at the top.',
          { methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Heavy DB RDL', '4', '5', '2:30', 'Maximize hamstring tension. 3s lower.',
          { intensity: 'Heavy DB', tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Single-Leg RDL to Knee Drive', '3', '5 each', '2:00', 'RDL down, explosive knee drive up. Two actions, one movement.',
          { methodType: 'mixed', intensityIntent: 'explosive' }),
      ],
      moderate: [
        ex('DB Squat', '3', '8', '2:30', 'Full depth. Explode from bottom.',
          { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
        ex('DB RDL', '3', '8', '2:00', 'Hinge deep. Hamstring-led return.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'moderate' }),
        ex('DB Reverse Lunge', '3', '8 each', '2:00', 'Long step. Control the descent.',
          { tempo: '2-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
      ],
    },
    none: {
      heavy: [
        ex('Pistol Squat', '3', '5 each', '2:30', 'Full depth. 3s down. Fingertip support only if needed.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Nordic Hamstring Curl', '3', '5', '3:00', '4s eccentric. Catch at 45°. Partner-anchored.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Step-Up (High Box)', '3', '6 each', '2:00', 'Drive through working leg only. No push from back foot.',
          { methodType: 'concentric', intensityIntent: 'controlled' }),
      ],
      moderate: [
        ex('Pistol Squat Progression', '3', '6 each', '2:30', 'Box support if needed. Building depth.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'moderate' }),
        ex('Nordic Hamstring Curl', '3', '4', '3:00', '4s down. Partner or door.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Jump Squat (BW)', '3', '6', '2:00', 'Full squat, max upward intent. Land and reset.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    },
  },
  'Strength & Power': {
    full: {
      heavy: [
        ex('Back Squat', '5', '3', '4:00', 'Maximum neural drive every rep. Treat it like a max.',
          { intensity: '85–88% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Power Clean', '4', '3', '3:30', 'Hook grip. Violent triple extension. High elbows in the catch.',
          { intensity: '78% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Hex Bar Deadlift', '4', '3', '3:30', 'Optimal hip position. Accelerate through the whole pull.',
          { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
      moderate: [
        ex('Back Squat', '4', '4', '3:30', 'High intent. Every rep is technically sound and fast.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Power Clean', '3', '3', '3:00', 'Speed is the goal. Technical mastery at this load.',
          { intensity: '72% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Hex Bar Deadlift', '3', '4', '3:00', 'Drive through with intent. Bar doesn\'t decelerate.',
          { intensity: '75% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
      ],
    },
    basic: {
      heavy: [
        ex('DB Hang Snatch', '4', '4 each', '3:00', 'Hinge and pull. Drive elbow high. Stable overhead lock.',
          { methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('DB Jump Squat', '4', '4', '3:00', 'Full depth. Explode upward. Absorb the landing — hips, knees, ankles.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Heavy Single-Leg RDL', '4', '5 each', '2:30', 'Maximum hip load. No spinal rotation.',
          { intensity: 'Heavy DB', tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
      moderate: [
        ex('DB Hang Snatch', '3', '4 each', '2:30', 'Smooth hinge-pull-lock sequence.',
          { methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('DB Jump Squat', '3', '4', '2:30', 'Explosive up. Controlled landing.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Single-Leg RDL', '3', '6 each', '2:00', 'Controlled eccentric. Hamstring-led.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
      ],
    },
    none: {
      heavy: [
        ex('Broad Jump', '4', '4', '3:00', 'Max horizontal. Stick the landing. Full reset before each rep.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Nordic Hamstring Curl', '4', '5', '3:30', '4s down. Build tensile hamstring strength.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Depth Drop → Vertical Jump', '3', '4', '3:00', 'Step off. Minimise ground contact. Reactive vertical rebound.',
          { methodType: 'reactive', intensityIntent: 'reactive' }),
      ],
      moderate: [
        ex('Broad Jump', '3', '4', '2:30', 'Max horizontal distance. Land and hold.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Nordic Hamstring Curl', '3', '4', '3:00', '4s eccentric. Technique is the priority.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Plyometric Step-Up', '3', '5 each', '2:00', 'Drive upward explosively. Land soft.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    },
  },
  Peak: {
    full: {
      heavy: [
        ex('Back Squat', '4', '2', '4:00', 'Treat every rep as a maximum. Maximum neural drive. Non-negotiable rest.',
          { intensity: '90–95% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Power Clean', '4', '2', '4:00', 'Speed over load. Aggressive enough to matter. Technically perfect.',
          { intensity: '80% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Jump Squat', '4', '4', '3:00', 'Maximum intent upward. Land and fully reset.',
          { intensity: '30% 1RM', methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
      moderate: [
        ex('Back Squat', '3', '3', '4:00', 'High quality, full recovery, max intent.',
          { intensity: '87% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
        ex('Power Clean', '3', '2', '3:30', 'Velocity is the stimulus. Perfect technique.',
          { intensity: '75% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'explosive' }),
        ex('Jump Squat', '3', '4', '3:00', 'Explosive. Land and reset.',
          { intensity: '30% 1RM', methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    },
    basic: {
      heavy: [
        ex('DB Jump Squat', '4', '4', '3:00', 'Maximum expression. Absorb the landing fully.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Heavy DB RDL', '4', '4', '3:00', 'Full eccentric load. Hamstring-led.',
          { intensity: 'Heavy DB', tempo: '3-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Depth Drop → Jump', '3', '4', '3:00', 'Step off box. Minimise contact. Express reactive power.',
          { methodType: 'reactive', intensityIntent: 'reactive' }),
      ],
      moderate: [
        ex('DB Jump Squat', '3', '4', '2:30', 'Explosive up. Controlled landing.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('DB RDL', '3', '5', '2:30', 'Slow eccentric. Hamstring load.',
          { tempo: '3-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Box Jump', '3', '4', '2:30', 'Step down. Full reset. Max intent each rep.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    },
    none: {
      heavy: [
        ex('Plyometric Push-Up', '3', '5', '3:00', 'Explosive push — leave the ground. Soft landing.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Depth Drop', '4', '4', '3:00', 'Step off. Minimise contact. Max vertical.',
          { methodType: 'reactive', intensityIntent: 'reactive' }),
        ex('Bounding Sprint', '4', '30m', '90s', 'Max push-off. Stride length. Arms drive hard.',
          { methodType: 'concentric', intensityIntent: 'explosive' }),
      ],
      moderate: [
        ex('Squat Jump', '3', '5', '2:30', 'Full depth. Max intent upward.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
        ex('Nordic Hamstring Curl', '3', '4', '3:00', '4s eccentric. Quality above everything.',
          { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
        ex('Broad Jump', '3', '4', '2:30', 'Max horizontal. Stick the landing.',
          { methodType: 'reactive', intensityIntent: 'explosive' }),
      ],
    },
  },
};

// ── Upper body ─────────────────────────────────────────────────────────────

const UPPER: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('DB Bench Press', '3', '10', '2:00', 'Retract shoulder blades. Controlled descent. Explosive push.',
      { intensity: '60% effort', tempo: '3-0-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('DB Row', '3', '10', '2:00', 'Hinge 45°. Pull elbow to hip. Squeeze lat at top.',
      { tempo: '2-1-1-0', methodType: 'concentric', intensityIntent: 'moderate' }),
    ex('DB Shoulder Press', '3', '10', '90s', 'Neutral spine. No arching. Full lockout overhead.',
      { intensity: 'Moderate', methodType: 'concentric', intensityIntent: 'moderate' }),
  ],
  Build: [
    ex('Bench Press', '4', '5', '3:00', 'Explosive push. 2s controlled descent. Just outside shoulder-width.',
      { intensity: '75% 1RM', tempo: '2-0-x-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Weighted Pull-Up', '4', '4', '3:00', 'Dead hang to chin over bar. Initiate with lats.',
      { intensity: 'Add 5–10kg', tempo: '1-1-1-0', methodType: 'concentric', intensityIntent: 'controlled' }),
    ex('Push Press', '3', '4', '2:30', 'Dip and drive hips. Aggressive lockout. Bar over heels.',
      { intensity: '75% 1RM', methodType: 'concentric', intensityIntent: 'explosive' }),
  ],
  'Strength & Power': [
    ex('Bench Press', '4', '3', '3:30', 'Maximum force intent.',
      { intensity: '82% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Weighted Pull-Up', '4', '3', '3:00', '1s pause at top. 3s descent. No kipping.',
      { intensity: 'Challenging', tempo: '1-1-x-3', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Med Ball Chest Pass (Wall)', '3', '6', '90s', 'Drive through ball explosively. Max power output.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
  Peak: [
    ex('Bench Press', '3', '2', '4:00', 'Max intent. Full recovery.',
      { intensity: '90% 1RM', tempo: '1-0-x-0', methodType: 'concentric', intensityIntent: 'maximal' }),
    ex('Weighted Pull-Up', '3', '3', '4:00', 'Explosive concentric. 4s descent.',
      { intensity: 'Heavy', tempo: '1-0-x-4', methodType: 'eccentric', intensityIntent: 'maximal' }),
    ex('Med Ball Slam', '4', '5', '90s', 'Overhead drive then slam with full-body tension.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  ],
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
    Foundation: ex('Interval Shuttle', '4', '6 × 20m', '2:00 between sets', 'Moderate pace. COD focus. 75% max effort.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('10s Sprint / 20s Walk Intervals', '1', '8 rounds (4 min total)', '3:00 after all rounds', 'Max intent each 10s sprint. Full walk recovery. Short, sharp, anaerobic.',
      { methodType: 'mixed', intensityIntent: 'explosive' }),
    'Strength & Power': ex('Flying 20m Repeat Sprint', '6', '20m', '30s rest', 'Near-max each rep. Rolling start — hit top speed inside 20m.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    Peak: ex('Sprint Finisher', '3', '4 × 10m', '2:00 between sets', 'Sharp, reactive. 100% intent every rep. Quality over quantity.',
      { methodType: 'reactive', intensityIntent: 'explosive' }),
  },
  CB: {
    Foundation: ex('Deceleration Sprint Drill', '4', '30m sprint → brake', '2:00', 'Sprint 30m, plant and brake hard. Focus: eccentric knee and hip control at high speed.',
      { methodType: 'eccentric', intensityIntent: 'controlled' }),
    Build: ex('Repeated 30m Sprint', '6', '30m', '30s rest', '85% effort. Sprint, walk back, repeat. Build repeated sprint ability.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    'Strength & Power': ex('High-Intensity 20m Shuttle', '6', '20m', '30s rest', '100% effort each rep. Max deceleration at turn. Short rest — build lactate tolerance.',
      { methodType: 'mixed', intensityIntent: 'maximal' }),
    Peak: ex('Short Sprint Repeats', '6', '10–20m', '45s rest', '95–100% effort. Sharp and reactive. Match sprint intensity.',
      { methodType: 'concentric', intensityIntent: 'explosive' }),
  },
  FB: {
    Foundation: ex('Repeated 40m Sprint', '6', '40m', '25s rest', '80% effort. Build repeated sprint tolerance. Walk back is rest.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    Build: ex('400m Tempo Run', '4', '400m', '90s rest', '75–80% max HR. Hold pace each rep. Aerobic base for full-back distances.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    'Strength & Power': ex('Shuttle Sprint Repeats', '8', '40m', '20s rest', '90% effort. Short rest demands high aerobic power. Full-back endurance capacity.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    Peak: ex('4×4 Interval', '4', '4 min at 85% max HR', '3:00 rest', 'HR above 85% for full interval. Match demand simulation for wide players.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
  },
  CM: {
    Foundation: ex('Aerobic Tempo Run', '3', '1000m', '2:00 rest', '70% effort — conversational pace. Build the aerobic engine.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
    Build: ex('4×4 Interval Run', '4', '4 min at 85% max HR', '3:00 rest', 'HR > 90% for last minute of each rep. CM aerobic-anaerobic base.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    'Strength & Power': ex('30-15 Intermittent Fitness Protocol', '1', '12 min continuous', '', 'Run 30s at 13–14 km/h, walk 15s. Repeat for 12 min. Classic box-to-box conditioning.',
      { methodType: 'mixed', intensityIntent: 'submaximal' }),
    Peak: ex('High-Intensity 20m Shuttle', '6', '20m', '30s rest', 'Max each rep. Box-to-box simulation. Fully explosive transitions.',
      { methodType: 'mixed', intensityIntent: 'maximal' }),
  },
  W: {
    Foundation: ex('Repeated 40m Sprint', '6', '40m', '25s rest', '85% effort. Build RSA tolerance. Walk back = rest.',
      { methodType: 'concentric', intensityIntent: 'submaximal' }),
    Build: ex('Repeated 40m Sprint', '8', '40m', '20s rest', '90% effort. Higher anaerobic demand. Winger repeat-sprint profile.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    'Strength & Power': ex('Flying 30m Repeat Sprint', '6', '30m', '45s rest', 'Max velocity. Near-complete recovery. Winger speed endurance.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    Peak: ex('Sprint Cluster', '4', '3 × 20m (15s between)', '3:00 between sets', 'Match-like sprint clusters. Maximal intent every rep.',
      { methodType: 'concentric', intensityIntent: 'explosive' }),
  },
  ST: {
    Foundation: ex('Sprint + Jog Recovery Circuit', '6', '30m sprint / 40m jog recovery', 'Continuous circuit', 'Sprint the 30m, jog 40m recovery. Builds aerobic base without full rest.',
      { methodType: 'mixed', intensityIntent: 'moderate' }),
    Build: ex('10m Burst Repeats', '10', '10m', '30s rest', '100% intent every rep. Explosive first step. Striker penalty-area sprint simulation.',
      { methodType: 'reactive', intensityIntent: 'maximal' }),
    'Strength & Power': ex('Repeated 20m Sprint', '8', '20m', '20s rest', 'Near-maximal. Short rest. Anaerobic capacity — peak box arrival speed.',
      { methodType: 'concentric', intensityIntent: 'maximal' }),
    Peak: ex('Sprint + Jump Finisher', '3', '3 × 15m then CMJ', '3:00 between sets', 'Three sprints then a max CMJ. Striker match-day movement pattern.',
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
    ex('Resisted Hip Extension (Band)', '3', '12 each', '90s', 'Full hip extension against band. Glute drive. Sprint push-off simulation.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
  ],
  strength: [
    ex('Tempo Squat', '4', '4', '3:00', '3s descent, 1s pause at bottom, explosive up. Time under tension.',
      { intensity: '70% 1RM', tempo: '3-1-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Eccentric RDL', '3', '6', '2:30', '4s lowering. Load the hamstring eccentrically.',
      { intensity: 'Moderate', tempo: '4-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Isometric Split Squat Hold', '3', '40s each', '2:00', 'Bottom position hold. Strength and joint stability.',
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
    ex('Rotational Med Ball Throw', '3', '6 each', '2:00', 'Hips rotate first, shoulders follow. Explosive release.',
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
    ex('Nordic Hamstring Curl', '3', '5', '3:00', '4s eccentric. Gold standard — non-negotiable for every footballer.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Copenhagen Plank', '3', '30s each', '90s', 'Groin-specific. Top foot on bench. Pull bottom leg. Most evidenced groin prevention.',
      { tempo: '0-30s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Single-Leg Balance Reach', '3', '10 each', '60s', 'Reach forward, lateral, diagonal. Ankle stability and proprioception.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
};

// ── Prehab by injury area ──────────────────────────────────────────────────

const PREHAB: Record<string, ProgrammeExercise[]> = {
  hamstring: [
    ex('Nordic Hamstring Curl', '3', '5', '3:00', '4s eccentric. Highest-evidence prevention. Non-negotiable.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Eccentric Single-Leg RDL', '2', '8 each', '90s', '4s lowering. Hold at bottom. Eccentric load is the protective stimulus.',
      { tempo: '4-1-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  ankle: [
    ex('Single-Leg Balance (Eyes Closed)', '3', '40s each', '60s', 'Slight knee bend. Eyes closed when easy. Proprioception training.',
      { tempo: '0-40s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Banded Ankle Dorsiflexion Mob', '2', '10 each', '30s', 'Band pulls heel forward. Drive knee over small toe. Restore dorsiflexion.',
      { methodType: 'mixed', intensityIntent: 'controlled' }),
  ],
  knee: [
    ex('Terminal Knee Extension (Band)', '3', '15 each', '60s', 'VMO isolation. Full lockout. Slow and controlled.',
      { tempo: '1-1-3-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Eccentric Step-Down', '3', '10 each', '90s', '4s descent to single-foot landing. Track knee over second toe.',
      { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  groin: [
    ex('Copenhagen Plank', '3', '25s each side', '90s', 'Adductor isolation. Top foot on bench. Gold standard for groin prevention.',
      { tempo: '0-25s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Lateral Band Walk', '2', '15 each way', '60s', 'Targets groin–hip abductor relationship. Controlled.',
      { methodType: 'concentric', intensityIntent: 'moderate' }),
  ],
  calf: [
    ex('Eccentric Calf Raise (Alfredson)', '3', '12', '60s', 'Raise with both, lower on one. 3s eccentric. Classic protocol.',
      { tempo: '3-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Soleus Raise (Bent Knee)', '2', '15 each', '60s', 'Knee at 90°. Targets soleus. Slow and deliberate.',
      { tempo: '2-0-1-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ],
  back: [
    ex('Dead Bug', '3', '6 each side', '60s', 'Lower back into floor. Extend opposite arm and leg — don\'t lose lumbar position.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
    ex('Pallof Press', '3', '10 each side', '60s', 'Anti-rotation. Resist band. Body stays square throughout.',
      { methodType: 'isometric', intensityIntent: 'controlled' }),
  ],
  shoulder: [
    ex('Band External Rotation', '3', '15 each', '60s', 'Elbow pinned to side. Slow intentional outward rotation.',
      { tempo: '2-0-2-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
    ex('Y-T-W on Incline Bench', '3', '8 each letter', '60s', 'Scapular control. Light weight. Each rep fully deliberate.',
      { methodType: 'concentric', intensityIntent: 'controlled' }),
  ],
};

const DEFAULT_PREHAB: ProgrammeExercise[] = [
  ex('Nordic Hamstring Curl', '2', '5', '3:00', '4s eccentric. Highest-evidence injury prevention for every footballer.',
    { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'controlled' }),
  ex('Copenhagen Plank', '2', '20s each side', '60s', 'Adductor strength. Build the hold week by week.',
    { tempo: '0-20s-0-0', methodType: 'isometric', intensityIntent: 'controlled' }),
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
    objective: 'Active recovery — flush metabolic waste, restore ROM, prepare for the week ahead.',
    readinessNote: 'MD+1 is always low load regardless of readiness. Protect your body — gains happen in recovery.',
    durationMin: 35,
    fvProfile: 'Recovery — no F-V output. Movement only.',
    blocks: [
      {
        title: '🔄 Soft Tissue + Mobility',
        methodFocus: 'Parasympathetic — connective tissue quality and ROM restoration',
        exercises: [
          ex('Foam Roll: Quads, Hamstrings, IT Band, Calves', '1', '90s each area', '', 'Slow rolls. Pause on tender spots 5–10s.',
            { methodType: 'mixed', intensityIntent: 'controlled' }),
          ex('Static Hip Flexor Stretch', '1', '60s each side', '', 'Tall kneeling. Posterior pelvic tilt. Feel front of hip.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
          ex('Supine Piriformis Stretch', '1', '60s each side', '', 'Figure-4. Pull knee toward opposite shoulder gently.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
      {
        title: '⚡ Light Activation',
        methodFocus: 'Neural — light concentric to promote blood flow without load',
        exercises: [
          ex('Glute Bridge (Light)', '2', '15', '30s', 'Blood flow only. Not a strength exercise.',
            { methodType: 'concentric', intensityIntent: 'moderate' }),
          ex('Band Clamshell', '2', '15 each', '30s', 'Light band. Hip external rotation. Activate without loading.',
            { methodType: 'concentric', intensityIntent: 'moderate' }),
          ex('Light Bike or Walk', '1', '20 min at 55–65% max HR', '', 'HR below 130 bpm throughout. Active recovery — promotes blood flow without adding fatigue.',
            { intensityIntent: 'moderate' }),
        ],
      },
    ],
  };
}

// ── Neural priming session (MD-1) ──────────────────────────────────────────

function primingSession(dow: string, position: string, playStyle: string): ProgrammeSession {
  const positionPriming: Partial<Record<string, ProgrammeExercise[]>> = {
    GK: [ex('Lateral Bound + Stick', '3', '3 each way', '2:00', 'Explosive bound. Stick landing 1s. Prime reaction patterns.',
      { methodType: 'reactive', intensityIntent: 'explosive' })],
    W: [ex('Block Start Acceleration', '4', '10m', '2:00', '3-point start. Max intent. Short and sharp. Fire the CNS.',
      { methodType: 'concentric', intensityIntent: 'explosive' })],
    ST: [ex('5m Explosive Burst', '5', '5m', '90s', 'From varied stances. Max first step. Neural sharpness only.',
      { methodType: 'reactive', intensityIntent: 'explosive' })],
  };

  const styleNote = playStyle === 'counter-attack'
    ? 'Pay particular attention to transition speed — tomorrow\'s game may require explosive acceleration quickly.'
    : playStyle === 'press-heavy'
    ? 'Priming mirrors the press demands — short, sharp, full effort, immediate recovery.'
    : 'Neural priming only. Low volume, maximum quality. Arrive tomorrow sharp, not heavy.';

  return {
    mdDay: 'MD-1',
    dayOfWeek: dow,
    objective: `Neural priming — activate fast-twitch fibres without accumulating fatigue. ${styleNote}`,
    readinessNote: 'MD-1 is always low load. Do NOT add volume regardless of readiness score.',
    durationMin: 30,
    fvProfile: 'Speed end of F-V curve — submaximal load, maximal intent, zero accumulated fatigue.',
    blocks: [
      {
        title: '🔥 Movement Prep',
        methodFocus: 'Mobility and CNS ramp — prepare joints and nervous system',
        exercises: [
          ...WARMUP_MOBILITY.slice(0, 2),
          ex('A-Skip', '2', '20m', '30s', 'Neural warm-up. Crisp mechanics. Light and fast.',
            { intensityIntent: 'moderate' }),
        ],
      },
      {
        title: '⚡ Neural Priming',
        methodFocus: 'Fast-twitch activation — explosive quality, not conditioning',
        exercises: [
          ...(positionPriming[position] ?? [
            ex('Build-Up Sprint 60→80→90%', '4', '30m', '90s', 'Smooth ramp. Wake up the nervous system.',
              { methodType: 'concentric', intensityIntent: 'submaximal' }),
            ex('10m Acceleration Sprint', '3', '10m', '2:00', 'From walking start. Sharp first step. Full rest.',
              { methodType: 'concentric', intensityIntent: 'explosive' }),
          ]),
          ex('CMJ × 3 reps', '1', '3 reps', '2:00', 'Explosive jumps. Full rest between. Neural activation — not conditioning.',
            { methodType: 'reactive', intensityIntent: 'explosive' }),
        ],
      },
      {
        title: '🛡️ Pre-Match Prehab',
        methodFocus: 'Eccentric and isometric — protect the soft tissue ahead of match demands',
        exercises: [
          ex('Nordic Hamstring Curl (2 reps — sub-max)', '1', '2 reps', '', 'Light activation only. Protect for match day.',
            { tempo: '4-0-x-0', methodType: 'eccentric', intensityIntent: 'submaximal' }),
          ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Restore hip ROM before tomorrow\'s game.',
            { methodType: 'isometric', intensityIntent: 'controlled' }),
        ],
      },
    ],
  };
}

// ── Session objective labels ───────────────────────────────────────────────

const MD4_OBJ: Record<string, string> = {
  Foundation: 'Strength day. Establish movement patterns and build your foundational base. Focus on quality, not just load.',
  Build: 'Strength day. Increase load with position-specific power work. This is where your main physical gains are made.',
  'Strength & Power': 'Strength day. Peak force production. High neural demand. Take full rest between every main set.',
  Peak: 'Strength day. Express the strength you have built. High intent, reduced volume.',
};

const MD3_OBJ: Record<string, string> = {
  Foundation: 'Speed day. Develop your acceleration mechanics and position-specific movement patterns.',
  Build: 'Speed day. Build maximum velocity. Position-specific sprinting at near-maximum effort.',
  'Strength & Power': 'Speed day. Peak sprint session. Flying sprints and maximum velocity work.',
  Peak: 'Speed day. Sharpen your speed. Low volume, high quality. Stay fresh.',
};

const MD2_OBJ: Record<string, string> = {
  Foundation: 'Conditioning day. Build your aerobic base and reinforce movement quality. Moderate effort throughout.',
  Build: 'Conditioning day. Position-specific aerobic work. Build repeated-effort capacity for match demands.',
  'Strength & Power': 'Conditioning day. Develop your work capacity without leaving fatigue that carries into match day.',
  Peak: 'Conditioning day. Short, sharp and focused. Stay crisp.',
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
  const upperEx = UPPER[phase] ?? UPPER.Build;

  const posKey = position as PosKey;
  const posSpeedEx = POSITION_SPEED[posKey] ?? [];
  const accelEx = SPEED_ACCELERATION[phase] ?? SPEED_ACCELERATION.Foundation;
  const condExMD2 = CONDITIONING_MD2[posKey]?.[phase] ?? CONDITIONING_MD2.CM.Foundation;
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
      ? 'Elite readiness ✦ — Add a bonus set to your main lifts. Chase a PB on your primary compound today.'
      : readiness.level === 'high'
      ? 'High readiness ✓ — Execute as written. Push hard on the big sets.'
      : readiness.level === 'moderate'
      ? 'Moderate readiness — Reduce load ~10% on main compounds. Monitor RPE set-to-set.'
      : 'Low readiness — 1 fewer set, −20–25% intensity. Movement quality over load today.';

  const durationBase = slot.mdDay === 'MD-4' ? 70 : slot.mdDay === 'MD-3' ? 60 : 55;
  const durationMin = readiness.level === 'low' ? durationBase - 15
    : readiness.level === 'elite' ? durationBase + 10
    : durationBase;

  // MD-4: full strength + power + upper + weakness + prehab
  if (slot.mdDay === 'MD-4') {
    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: MD4_OBJ[phase] ?? MD4_OBJ.Build,
      readinessNote, durationMin,
      fvProfile: fv.profile,
      blocks: [
        {
          title: '🔥 Warm-Up (12 min)',
          methodFocus: 'Mobility + concentric ramp — full joint prep before heavy loading',
          exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 2)],
        },
        {
          title: '💪 Main Strength Block',
          methodFocus: fv.loadScheme === 'heavy'
            ? 'Maximal force — strength end of F-V curve. High load, low velocity, peak neural output.'
            : 'Strength-speed — moderate load with explosive intent. Bridge between strength and power.',
          exercises: applyReadiness(strengthEx, readiness.level, readiness.intensityNote),
        },
        {
          title: '⚡ Power Superset',
          methodFocus: 'Reactive / concentric — post-activation potentiation following strength block',
          exercises: applyReadiness([
            ex('Jump Squat', '3', '4', '2:30', 'Load 30% bodyweight. Max upward intent. Land and reset.',
              { intensity: '30% BW', methodType: 'reactive', intensityIntent: 'explosive' }),
            ex('Medicine Ball Slam', '3', '5', '90s', 'Full-body tension. Overhead drive, slam down.',
              { methodType: 'reactive', intensityIntent: 'explosive' }),
          ], readiness.level, readiness.intensityNote),
        },
        {
          title: '💪 Upper Body Accessory',
          methodFocus: 'Concentric + eccentric — upper body strength balance and shoulder integrity',
          exercises: applyReadiness(upperEx.slice(0, 2), readiness.level, readiness.intensityNote),
        },
        ...(playStyleEx.length > 0 ? [{
          title: '🎮 Play Style Block',
          methodFocus: `${inputs.playStyle.replace('-', ' ')} specific — translating physical output to your game model`,
          exercises: playStyleEx,
        }] : []),
        {
          title: '🎯 Weakness Focus',
          methodFocus: `${biggestWeakness} development — targeted overload of your primary physical gap`,
          exercises: weaknessEx,
        },
        {
          title: '🛡️ Injury Prevention',
          methodFocus: 'Eccentric + isometric — structural resilience and prehab loading',
          exercises: prehabEx,
        },
      ],
    };
  }

  // MD-3: speed + acceleration + strength accessories + prehab
  if (slot.mdDay === 'MD-3') {
    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: MD3_OBJ[phase] ?? MD3_OBJ.Build,
      readinessNote, durationMin,
      fvProfile: fv.profile,
      blocks: [
        {
          title: '🔥 Sprint Prep (15 min)',
          methodFocus: 'CNS ramp — progressive velocity build before maximum-speed work',
          exercises: [...WARMUP_MOBILITY.slice(0, 2), ...WARMUP_SPEED],
        },
        {
          title: '⚡ Acceleration Block',
          methodFocus: 'Concentric — drive phase mechanics, maximum force application angle',
          exercises: [...accelEx.slice(0, 2), ...(posSpeedEx.slice(0, 1))],
        },
        {
          title: '💪 Strength Accessories',
          methodFocus: 'Eccentric — unilateral strength and posterior chain maintenance',
          exercises: applyReadiness([
            strengthEx[1] ?? strengthEx[0],
            ex('Single-Leg Glute Bridge', '3', '15 each', '60s', 'Drive heel into floor. Full hip extension. Pelvis doesn\'t rotate.',
              { methodType: 'concentric', intensityIntent: 'moderate' }),
          ], readiness.level, readiness.intensityNote),
        },
        {
          title: '🎯 Weakness Focus',
          methodFocus: `${biggestWeakness} — maintained at minimum effective dose on speed day`,
          exercises: weaknessEx.slice(0, 1),
        },
        {
          title: '🛡️ Injury Prevention',
          methodFocus: 'Eccentric + isometric — protect soft tissue ahead of match week intensification',
          exercises: prehabEx,
        },
      ],
    };
  }

  // MD-2: LOW-IMPACT cross-training + technical speed + weakness + prehab
  // Science: 2 days before match → must avoid muscular fatigue carryover.
  // Bike / pool / ergometer only — maintains aerobic sharpness without loading sprint muscles.
  if (slot.mdDay === 'MD-2') {
    return {
      mdDay: slot.mdDay, dayOfWeek: slot.dayOfWeek,
      objective: (MD2_OBJ[phase] ?? MD2_OBJ.Build) + ' Low-impact cross-training only — protect legs for match day.',
      readinessNote: readinessNote + ' MD-2: bike or pool conditioning only. No running.',
      durationMin, fvProfile: fv.profile,
      blocks: [
        {
          title: '🔥 Warm-Up (10 min)',
          methodFocus: 'Aerobic ramp — elevate HR progressively, minimal impact',
          exercises: [...WARMUP_MOBILITY.slice(0, 2), ...WARMUP_NEURAL.slice(0, 2)],
        },
        {
          title: '🚴 Low-Impact Conditioning',
          methodFocus: 'Bike / pool — maintain aerobic sharpness without fatigue carryover into match',
          exercises: applyReadiness([condExMD2], readiness.level, readiness.intensityNote),
        },
        {
          title: '⚡ Technical Speed (Low Volume)',
          methodFocus: 'Reactive — position-specific patterns at match velocity. Max 2 exercises, full recovery. MD-2: volume halved.',
          exercises: (posSpeedEx.length > 0 ? posSpeedEx.slice(0, 1) : accelEx.slice(0, 1)),
        },
        {
          title: '🎯 Weakness Focus (Maintenance)',
          methodFocus: `${biggestWeakness} — 1 exercise only. Maintain stimulus, do not accumulate fatigue before match.`,
          exercises: weaknessEx.slice(0, 1),
        },
        {
          title: '🛡️ Injury Prevention',
          methodFocus: 'Isometric + eccentric — joint integrity maintenance 2 days before match',
          exercises: prehabEx,
        },
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
  if (week <= 5) return `Add 2.5–5kg to main compounds and extend sprint volumes vs last week. RPE 7–8.`;
  if (week <= 9) return `Push toward technical limit — RPE 8–9. ${hint}`;
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

  return `This ${totalWeeks}-week programme is designed for a ${pos} with a primary focus on ${goal}. It covers ${fvLine}.\n\n${weaknessLine}${styleNote}\n\nEvery session uses a three-method structure. Concentric work builds force production, eccentric work creates structural resilience and reduces injury risk, and isometric work develops joint stability. All three are trained throughout the programme.\n\nSessions are structured around your match schedule. The heaviest training falls furthest from match day, and load is progressively reduced as the game approaches. This protects performance on the pitch while ensuring consistent physical development across the week.\n\n${readinessLine}`;
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

  return {
    id: `prog-${Date.now()}`,
    createdAt: Date.now(),
    title: `${pos} — ${goal}`,
    summary: `${totalWeeks}-week personalised programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${inputs.sessionsPerWeek} sessions/week · Match day: ${matchStr}.`,
    coachExplanation: buildCoachExplanation(inputs, totalWeeks, readinessLevel),
    readinessScore: score,
    readinessLevel,
    readinessGuidance,
    durationWeeks: totalWeeks,
    inputs,
    weeks,
  };
}
