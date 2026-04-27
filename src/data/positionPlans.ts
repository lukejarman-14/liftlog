import { WorkoutExercise, PositionPlan, PlanWeek } from '../types';
import { BuiltInTemplate } from './programs';

function ex(
  exerciseId: string,
  targetSets: number,
  targetReps: number,
  targetWeight: number,
  restSeconds: number,
): WorkoutExercise {
  return { exerciseId, targetSets, targetReps, targetWeight, restSeconds };
}

// ── Position session templates ────────────────────────────────────────────
// Each position has 3 session archetypes (A/B/C) used across the 8-week plan.
// Structure: Plyometrics → Strength → Eccentric → Isometric → Conditioning

export const POSITION_TEMPLATES: BuiltInTemplate[] = [

  // ── GOALKEEPER ──────────────────────────────────────────────────────────
  {
    id: 'gk-session-a', name: 'GK — Reactive Power', description: 'Reaction jumps, upper body strength, ankle/adductor resilience, agility conditioning.',
    program: 'Goalkeeper', exercises: [
      ex('reactive-drop-jump', 4, 5,  0,  150), ex('lateral-box-jump',  3, 8,  0,  90),  ex('pogo-jump', 3, 20, 0, 60),
      ex('bench-press',        4, 6,  65, 180), ex('barbell-row',       4, 6,  55, 180), ex('ohp', 3, 8, 40, 150), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-calf-raise',3,12, 0,  90),  ex('eccentric-hip-adductor',3,10,0, 90),
      ex('dead-hang',          3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      ex('agility-circuit',    4, 1,  0,  90),
    ],
  },
  {
    id: 'gk-session-b', name: 'GK — Lower & COD', description: 'Lateral bounds, squat-based strength, hamstring & hip flexor eccentrics, core isometrics, shuttle conditioning.',
    program: 'Goalkeeper', exercises: [
      ex('lateral-bound',      4, 8,  0,  90),  ex('approach-jump',     3, 5,  0,  120), ex('skater-jump', 3, 10, 0, 90),
      ex('squat',              4, 6,  80, 240),  ex('rdl',               3, 8,  65, 180), ex('hip-thrust', 3, 10, 75, 120),
      ex('eccentric-psoas',    3, 10, 0,  90),   ex('eccentric-sl-rdl',  3, 8,  0,  90),
      ex('hollow-hold',        3, 1,  0,  60),   ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('shuttle-run',        5, 1,  0,  60),
    ],
  },
  {
    id: 'gk-session-c', name: 'GK — Full Body Power', description: 'Vertical power, Olympic strength, full posterior chain, stability, and repeated agility.',
    program: 'Goalkeeper', exercises: [
      ex('box-jump',           4, 5,  0,  120),  ex('depth-jump',        3, 5,  0,  150), ex('tuck-jump', 3, 8, 0, 90),
      ex('power-clean',        4, 3,  60, 180),  ex('deadlift',          3, 5,  95, 240), ex('front-squat', 3, 6, 60, 180),
      ex('eccentric-nordic',   3, 6,  0,  120),  ex('eccentric-step-down',3,10, 0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),   ex('spanish-squat',     2, 1,  0,  60),
      ex('agility-circuit',    3, 1,  0,  90),
    ],
  },

  // ── CENTRE BACK ─────────────────────────────────────────────────────────
  {
    id: 'cb-session-a', name: 'CB — Aerial Power', description: 'Vertical jump, heavy strength, hamstring protection, quad isometrics, short sprint conditioning.',
    program: 'Centre Back', exercises: [
      ex('approach-jump',      4, 5,  0,  120),  ex('box-jump',          3, 5,  0,  120), ex('broad-jump', 3, 5, 0, 120),
      ex('squat',              5, 5,  90, 240),   ex('deadlift',          4, 4,  110,240), ex('hip-thrust', 3, 8, 90, 120),
      ex('eccentric-nordic',   4, 6,  0,  120),   ex('eccentric-calf-raise',3,12,0,  90),
      ex('spanish-squat',      3, 1,  0,  60),    ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('repeated-sprint',    6, 1,  0,  30),
    ],
  },
  {
    id: 'cb-session-b', name: 'CB — Upper Strength', description: 'Reactive plyos, upper body dominance, eccentric adductors, core stability, shuttle conditioning.',
    program: 'Centre Back', exercises: [
      ex('reactive-drop-jump', 3, 5,  0,  150),  ex('pogo-jump',         3, 20, 0,  60),  ex('lateral-bound', 3, 8, 0, 90),
      ex('bench-press',        4, 6,  70, 180),   ex('barbell-row',       4, 6,  60, 180), ex('ohp', 3, 8, 45, 150), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-hip-adductor',3,10,0,  90),   ex('eccentric-step-down',3,10, 0,  90),
      ex('dead-hang',          3, 1,  0,  60),    ex('side-plank',        2, 1,  0,  60),
      ex('shuttle-run',        4, 1,  0,  60),
    ],
  },
  {
    id: 'cb-session-c', name: 'CB — Full Power', description: 'Olympic lifting, posterior chain, full eccentric/isometric circuit, repeated sprints.',
    program: 'Centre Back', exercises: [
      ex('depth-jump',         4, 5,  0,  150),   ex('approach-jump',     3, 5,  0,  120), ex('jump-squat', 3, 6, 20, 90),
      ex('power-clean',        4, 3,  65, 180),   ex('front-squat',       3, 6,  70, 180), ex('rdl', 3, 8, 70, 180),
      ex('eccentric-sl-rdl',   3, 8,  0,  90),    ex('eccentric-psoas',   3, 10, 0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),    ex('hollow-hold',       2, 1,  0,  60),
      ex('repeated-sprint',    6, 1,  0,  30),
    ],
  },

  // ── FULL BACK ────────────────────────────────────────────────────────────
  {
    id: 'fb-pos-session-a', name: 'FB — Lateral Speed', description: 'Lateral bounds, balanced strength, adductor & calf eccentrics, hip isometrics, shuttle conditioning.',
    program: 'Full Back', exercises: [
      ex('lateral-bound',      4, 8,  0,  90),    ex('skater-jump',       3, 10, 0,  90),  ex('sprint', 4, 1, 0, 180),
      ex('squat',              4, 6,  82, 240),    ex('rdl',               3, 8,  68, 180), ex('hip-thrust', 3, 10, 80, 120), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-hip-adductor',3,10,0,  90),   ex('eccentric-calf-raise',3,12,0, 90),
      ex('side-plank',         3, 1,  0,  60),    ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('shuttle-run',        6, 1,  0,  45),
    ],
  },
  {
    id: 'fb-pos-session-b', name: 'FB — Upper & Reactive', description: 'Reactive cuts, upper body, hip flexor eccentrics, core stability, tempo conditioning.',
    program: 'Full Back', exercises: [
      ex('reactive-45-cut',    4, 8,  0,  90),    ex('pogo-jump',         3, 20, 0,  60),  ex('lateral-shuffle', 3, 20, 0, 60),
      ex('bench-press',        3, 8,  62, 150),   ex('barbell-row',       3, 8,  55, 150), ex('ohp', 3, 10, 40, 120), ex('chin-up', 3, 8, 0, 120),
      ex('eccentric-psoas',    3, 10, 0,  90),    ex('eccentric-step-down',3,10, 0,  90),
      ex('hollow-hold',        3, 1,  0,  60),    ex('side-plank',        2, 1,  0,  60),
      ex('tempo-run',          5, 1,  0,  90),
    ],
  },
  {
    id: 'fb-pos-session-c', name: 'FB — Full Body Endurance Power', description: 'Full body explosive work, Olympic lifting, posterior chain, repeated sprint conditioning.',
    program: 'Full Back', exercises: [
      ex('broad-jump',         4, 5,  0,  120),   ex('deceleration-drill',3, 6,  0,  90),  ex('bounding', 3, 8, 0, 120),
      ex('power-clean',        3, 3,  60, 180),   ex('deadlift',          3, 5,  95, 240), ex('front-squat', 3, 6, 62, 180),
      ex('eccentric-nordic',   3, 6,  0,  120),   ex('eccentric-sl-rdl',  3, 8,  0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),    ex('calf-raise-hold',   2, 1,  0,  45),
      ex('repeated-sprint',    8, 1,  0,  30),
    ],
  },

  // ── CENTRAL MIDFIELDER ───────────────────────────────────────────────────
  {
    id: 'cm-session-a', name: 'CM — Lower Endurance Power', description: 'COD plyos, balanced strength, hamstring & hip eccentrics, core isometrics, RSA conditioning.',
    program: 'Central Midfielder', exercises: [
      ex('reactive-45-cut',    4, 8,  0,  90),    ex('pogo-jump',         3, 20, 0,  60),  ex('tuck-jump', 3, 8, 0, 90),
      ex('squat',              4, 6,  80, 240),   ex('rdl',               3, 8,  65, 180), ex('hip-thrust', 3, 10, 78, 120),
      ex('eccentric-nordic',   3, 6,  0,  120),   ex('eccentric-psoas',   3, 10, 0,  90),
      ex('hollow-hold',        3, 1,  0,  60),    ex('wall-sit',          2, 1,  0,  60),
      ex('hiit-run',           8, 1,  0,  30),
    ],
  },
  {
    id: 'cm-session-b', name: 'CM — Upper & Reactive', description: 'Reactive agility, upper body strength, adductor & calf eccentrics, stability, HIIT conditioning.',
    program: 'Central Midfielder', exercises: [
      ex('lateral-shuffle',    4, 20, 0,  60),    ex('skater-jump',       3, 10, 0,  90),  ex('deceleration-drill', 3, 6, 0, 90),
      ex('bench-press',        3, 8,  62, 150),   ex('barbell-row',       3, 8,  55, 150), ex('ohp', 3, 10, 40, 120), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-hip-adductor',3,10,0,  90),   ex('eccentric-calf-raise',3,12,0, 90),
      ex('side-plank',         3, 1,  0,  60),    ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('hiit-run',           6, 1,  0,  30),
    ],
  },
  {
    id: 'cm-session-c', name: 'CM — Full Body RSA', description: 'Full body power, Olympic base, full eccentric circuit, repeated sprint ability conditioning.',
    program: 'Central Midfielder', exercises: [
      ex('broad-jump',         4, 5,  0,  120),   ex('hurdle-hop',        3, 8,  0,  90),  ex('lateral-bound', 3, 8, 0, 90),
      ex('power-clean',        3, 3,  60, 180),   ex('deadlift',          3, 5,  95, 240), ex('front-squat', 3, 6, 62, 180),
      ex('eccentric-sl-rdl',   3, 8,  0,  90),    ex('eccentric-step-down',3,10, 0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),    ex('hollow-hold',       2, 1,  0,  60),
      ex('repeated-sprint',    8, 1,  0,  30),
    ],
  },

  // ── WINGER ───────────────────────────────────────────────────────────────
  {
    id: 'w-session-a', name: 'Winger — Acceleration Power', description: 'Sprint plyos, explosive lower strength, calf & hamstring eccentrics, ankle isometrics, sprint conditioning.',
    program: 'Winger', exercises: [
      ex('sprint',             5, 1,  0,  180),   ex('broad-jump',        4, 5,  0,  120), ex('lateral-bound', 3, 8, 0, 90),
      ex('jump-squat',         4, 5,  25, 120),   ex('rdl',               3, 8,  68, 180), ex('power-clean', 3, 3, 62, 180), ex('hip-thrust', 3, 10, 80, 120),
      ex('eccentric-calf-raise',3,12, 0,  90),    ex('eccentric-sl-rdl',  3, 8,  0,  90),
      ex('calf-raise-hold',    3, 1,  0,  45),    ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('repeated-sprint',    6, 1,  0,  30),
    ],
  },
  {
    id: 'w-session-b', name: 'Winger — Lateral & Reactive', description: 'Lateral quickness, upper body, hip adductor/psoas eccentrics, core stability, shuttle sprints.',
    program: 'Winger', exercises: [
      ex('reactive-45-cut',    4, 8,  0,  90),    ex('skater-jump',       3, 10, 0,  90),  ex('deceleration-drill', 3, 6, 0, 90),
      ex('bench-press',        3, 8,  60, 150),   ex('barbell-row',       3, 8,  52, 150), ex('ohp', 3, 10, 38, 120), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-psoas',    3, 10, 0,  90),    ex('eccentric-hip-adductor',3,10,0, 90),
      ex('side-plank',         3, 1,  0,  60),    ex('hollow-hold',       2, 1,  0,  60),
      ex('shuttle-run',        5, 1,  0,  45),
    ],
  },
  {
    id: 'w-session-c', name: 'Winger — Full Explosive', description: 'Depth jumps, Olympic power, full chain eccentrics, stability, top-speed conditioning.',
    program: 'Winger', exercises: [
      ex('depth-jump',         4, 5,  0,  150),   ex('approach-jump',     3, 5,  0,  120), ex('bounding', 3, 8, 0, 120),
      ex('power-clean',        4, 3,  62, 180),   ex('deadlift',          3, 5,  98, 240), ex('squat', 3, 5, 85, 240),
      ex('eccentric-nordic',   3, 6,  0,  120),   ex('eccentric-step-down',3,10, 0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),    ex('spanish-squat',     2, 1,  0,  60),
      ex('sprint',             6, 1,  0,  180),
    ],
  },

  // ── STRIKER ──────────────────────────────────────────────────────────────
  {
    id: 'st-session-a', name: 'Striker — Explosive Lower', description: 'Approach jumps, power-focused strength, hamstring & quad eccentrics, power isometrics, sprint conditioning.',
    program: 'Striker', exercises: [
      ex('approach-jump',      4, 5,  0,  120),   ex('depth-jump',        3, 5,  0,  150), ex('jump-squat', 3, 6, 25, 90),
      ex('squat',              4, 5,  88, 240),   ex('power-clean',       4, 3,  65, 180), ex('hip-thrust', 3, 8, 88, 120),
      ex('eccentric-nordic',   3, 6,  0,  120),   ex('eccentric-step-down',3,10, 0,  90),
      ex('spanish-squat',      3, 1,  0,  60),    ex('hollow-hold',       2, 1,  0,  60),
      ex('sprint',             6, 1,  0,  180),
    ],
  },
  {
    id: 'st-session-b', name: 'Striker — Upper & Reactive', description: 'Reactive power, upper strength for hold-up play, hip & calf eccentrics, core stability, repeated sprint conditioning.',
    program: 'Striker', exercises: [
      ex('reactive-drop-jump', 3, 5,  0,  150),   ex('pogo-jump',         3, 20, 0,  60),  ex('reactive-45-cut', 3, 8, 0, 90),
      ex('bench-press',        4, 6,  68, 180),   ex('barbell-row',       4, 6,  58, 180), ex('ohp', 3, 8, 42, 150), ex('pull-up', 3, 8, 0, 120),
      ex('eccentric-hip-adductor',3,10,0,  90),   ex('eccentric-calf-raise',3,12,0, 90),
      ex('dead-hang',          3, 1,  0,  60),    ex('side-plank',        2, 1,  0,  60),
      ex('repeated-sprint',    6, 1,  0,  30),
    ],
  },
  {
    id: 'st-session-c', name: 'Striker — Full Power', description: 'Bounding, Olympic lifting, full eccentric circuit, core, sprint & agility conditioning.',
    program: 'Striker', exercises: [
      ex('broad-jump',         4, 5,  0,  120),   ex('bounding',          3, 8,  0,  120), ex('lateral-bound', 3, 8, 0, 90),
      ex('power-clean',        4, 3,  65, 180),   ex('deadlift',          3, 5,  100,240), ex('front-squat', 3, 6, 68, 180),
      ex('eccentric-sl-rdl',   3, 8,  0,  90),    ex('eccentric-psoas',   3, 10, 0,  90),
      ex('copenhagen-plank',   3, 1,  0,  60),    ex('glute-bridge-hold', 2, 1,  0,  60),
      ex('agility-circuit',    3, 1,  0,  90),
    ],
  },
];

// ── 8-week plan builder ───────────────────────────────────────────────────

function week(
  weekNumber: number,
  phase: string,
  monId: string,
  wedId: string,
  friId: string,
  monName: string,
  wedName: string,
  friName: string,
): PlanWeek {
  return {
    weekNumber,
    phase,
    sessions: [
      { dayOfWeek: 0, templateId: monId, name: monName, tags: ['Plyometrics', 'Strength', 'Eccentric'] },
      { dayOfWeek: 2, templateId: wedId, name: wedName, tags: ['Upper', 'Reactive', 'Conditioning'] },
      { dayOfWeek: 4, templateId: friId, name: friName, tags: ['Power', 'Full Body'] },
    ],
  };
}

// ── Position Plans ────────────────────────────────────────────────────────

export const POSITION_PLANS: PositionPlan[] = [
  {
    id: 'plan-goalkeeper',
    position: 'Goalkeeper',
    shortName: 'GK',
    description: 'Reaction power, upper body dominance, lateral agility and ankle/Achilles resilience. Builds from explosive foundation through to peak reactive ability.',
    weeks: [
      week(1, 'Foundation',  'gk-session-a', 'gk-session-b', 'gk-session-c', 'GK Reactive Power', 'GK Lower & COD', 'GK Full Body Power'),
      week(2, 'Foundation',  'gk-session-b', 'gk-session-c', 'gk-session-a', 'GK Lower & COD', 'GK Full Body Power', 'GK Reactive Power'),
      week(3, 'Build',       'gk-session-a', 'gk-session-b', 'gk-session-c', 'GK Reactive Power', 'GK Lower & COD', 'GK Full Body Power'),
      week(4, 'Build',       'gk-session-c', 'gk-session-a', 'gk-session-b', 'GK Full Body Power', 'GK Reactive Power', 'GK Lower & COD'),
      week(5, 'Strength',    'gk-session-a', 'gk-session-b', 'gk-session-c', 'GK Reactive Power', 'GK Lower & COD', 'GK Full Body Power'),
      week(6, 'Strength',    'gk-session-b', 'gk-session-c', 'gk-session-a', 'GK Lower & COD', 'GK Full Body Power', 'GK Reactive Power'),
      week(7, 'Power',       'gk-session-a', 'gk-session-b', 'gk-session-c', 'GK Reactive Power', 'GK Lower & COD', 'GK Full Body Power'),
      week(8, 'Peak',        'gk-session-c', 'gk-session-a', 'gk-session-b', 'GK Full Body Power', 'GK Reactive Power', 'GK Lower & COD'),
    ],
  },
  {
    id: 'plan-centre-back',
    position: 'Centre Back',
    shortName: 'CB',
    description: 'Aerial power, maximal strength, hamstring and adductor resilience. Built around heavy compound lifting and vertical jump development for dominance in the air.',
    weeks: [
      week(1, 'Foundation',  'cb-session-a', 'cb-session-b', 'cb-session-c', 'CB Aerial Power', 'CB Upper Strength', 'CB Full Power'),
      week(2, 'Foundation',  'cb-session-b', 'cb-session-c', 'cb-session-a', 'CB Upper Strength', 'CB Full Power', 'CB Aerial Power'),
      week(3, 'Build',       'cb-session-a', 'cb-session-b', 'cb-session-c', 'CB Aerial Power', 'CB Upper Strength', 'CB Full Power'),
      week(4, 'Build',       'cb-session-c', 'cb-session-a', 'cb-session-b', 'CB Full Power', 'CB Aerial Power', 'CB Upper Strength'),
      week(5, 'Strength',    'cb-session-a', 'cb-session-b', 'cb-session-c', 'CB Aerial Power', 'CB Upper Strength', 'CB Full Power'),
      week(6, 'Strength',    'cb-session-b', 'cb-session-c', 'cb-session-a', 'CB Upper Strength', 'CB Full Power', 'CB Aerial Power'),
      week(7, 'Power',       'cb-session-a', 'cb-session-b', 'cb-session-c', 'CB Aerial Power', 'CB Upper Strength', 'CB Full Power'),
      week(8, 'Peak',        'cb-session-c', 'cb-session-a', 'cb-session-b', 'CB Full Power', 'CB Aerial Power', 'CB Upper Strength'),
    ],
  },
  {
    id: 'plan-full-back',
    position: 'Full Back',
    shortName: 'FB',
    description: 'Lateral speed, endurance capacity and 1v1 defensive agility. High volume conditioning with balanced strength and adductor/calf injury prevention.',
    weeks: [
      week(1, 'Foundation',  'fb-pos-session-a', 'fb-pos-session-b', 'fb-pos-session-c', 'FB Lateral Speed', 'FB Upper & Reactive', 'FB Endurance Power'),
      week(2, 'Foundation',  'fb-pos-session-b', 'fb-pos-session-c', 'fb-pos-session-a', 'FB Upper & Reactive', 'FB Endurance Power', 'FB Lateral Speed'),
      week(3, 'Build',       'fb-pos-session-a', 'fb-pos-session-b', 'fb-pos-session-c', 'FB Lateral Speed', 'FB Upper & Reactive', 'FB Endurance Power'),
      week(4, 'Build',       'fb-pos-session-c', 'fb-pos-session-a', 'fb-pos-session-b', 'FB Endurance Power', 'FB Lateral Speed', 'FB Upper & Reactive'),
      week(5, 'Strength',    'fb-pos-session-a', 'fb-pos-session-b', 'fb-pos-session-c', 'FB Lateral Speed', 'FB Upper & Reactive', 'FB Endurance Power'),
      week(6, 'Strength',    'fb-pos-session-b', 'fb-pos-session-c', 'fb-pos-session-a', 'FB Upper & Reactive', 'FB Endurance Power', 'FB Lateral Speed'),
      week(7, 'Power',       'fb-pos-session-a', 'fb-pos-session-b', 'fb-pos-session-c', 'FB Lateral Speed', 'FB Upper & Reactive', 'FB Endurance Power'),
      week(8, 'Peak',        'fb-pos-session-c', 'fb-pos-session-a', 'fb-pos-session-b', 'FB Endurance Power', 'FB Lateral Speed', 'FB Upper & Reactive'),
    ],
  },
  {
    id: 'plan-midfielder',
    position: 'Central Midfielder',
    shortName: 'CM',
    description: 'Repeated sprint ability, change of direction and 90-minute endurance engine. Balanced strength with heavy RSA and HIIT conditioning throughout.',
    weeks: [
      week(1, 'Foundation',  'cm-session-a', 'cm-session-b', 'cm-session-c', 'CM Lower Endurance', 'CM Upper & Reactive', 'CM Full RSA'),
      week(2, 'Foundation',  'cm-session-b', 'cm-session-c', 'cm-session-a', 'CM Upper & Reactive', 'CM Full RSA', 'CM Lower Endurance'),
      week(3, 'Build',       'cm-session-a', 'cm-session-b', 'cm-session-c', 'CM Lower Endurance', 'CM Upper & Reactive', 'CM Full RSA'),
      week(4, 'Build',       'cm-session-c', 'cm-session-a', 'cm-session-b', 'CM Full RSA', 'CM Lower Endurance', 'CM Upper & Reactive'),
      week(5, 'Strength',    'cm-session-a', 'cm-session-b', 'cm-session-c', 'CM Lower Endurance', 'CM Upper & Reactive', 'CM Full RSA'),
      week(6, 'Strength',    'cm-session-b', 'cm-session-c', 'cm-session-a', 'CM Upper & Reactive', 'CM Full RSA', 'CM Lower Endurance'),
      week(7, 'Power',       'cm-session-a', 'cm-session-b', 'cm-session-c', 'CM Lower Endurance', 'CM Upper & Reactive', 'CM Full RSA'),
      week(8, 'Peak',        'cm-session-c', 'cm-session-a', 'cm-session-b', 'CM Full RSA', 'CM Lower Endurance', 'CM Upper & Reactive'),
    ],
  },
  {
    id: 'plan-winger',
    position: 'Winger',
    shortName: 'W',
    description: 'Top-end speed, acceleration and explosive 1v1 ability. Sprint-focused plyometrics, Olympic-based power development and calf/Achilles resilience.',
    weeks: [
      week(1, 'Foundation',  'w-session-a', 'w-session-b', 'w-session-c', 'W Acceleration Power', 'W Lateral & Reactive', 'W Full Explosive'),
      week(2, 'Foundation',  'w-session-b', 'w-session-c', 'w-session-a', 'W Lateral & Reactive', 'W Full Explosive', 'W Acceleration Power'),
      week(3, 'Build',       'w-session-a', 'w-session-b', 'w-session-c', 'W Acceleration Power', 'W Lateral & Reactive', 'W Full Explosive'),
      week(4, 'Build',       'w-session-c', 'w-session-a', 'w-session-b', 'W Full Explosive', 'W Acceleration Power', 'W Lateral & Reactive'),
      week(5, 'Strength',    'w-session-a', 'w-session-b', 'w-session-c', 'W Acceleration Power', 'W Lateral & Reactive', 'W Full Explosive'),
      week(6, 'Strength',    'w-session-b', 'w-session-c', 'w-session-a', 'W Lateral & Reactive', 'W Full Explosive', 'W Acceleration Power'),
      week(7, 'Power',       'w-session-a', 'w-session-b', 'w-session-c', 'W Acceleration Power', 'W Lateral & Reactive', 'W Full Explosive'),
      week(8, 'Peak',        'w-session-c', 'w-session-a', 'w-session-b', 'W Full Explosive', 'W Acceleration Power', 'W Lateral & Reactive'),
    ],
  },
  {
    id: 'plan-striker',
    position: 'Striker',
    shortName: 'ST',
    description: 'Explosive first step, aerial power and hold-up strength. Power-clean-based Olympic work, vertical jump development and sprint conditioning throughout.',
    weeks: [
      week(1, 'Foundation',  'st-session-a', 'st-session-b', 'st-session-c', 'ST Explosive Lower', 'ST Upper & Reactive', 'ST Full Power'),
      week(2, 'Foundation',  'st-session-b', 'st-session-c', 'st-session-a', 'ST Upper & Reactive', 'ST Full Power', 'ST Explosive Lower'),
      week(3, 'Build',       'st-session-a', 'st-session-b', 'st-session-c', 'ST Explosive Lower', 'ST Upper & Reactive', 'ST Full Power'),
      week(4, 'Build',       'st-session-c', 'st-session-a', 'st-session-b', 'ST Full Power', 'ST Explosive Lower', 'ST Upper & Reactive'),
      week(5, 'Strength',    'st-session-a', 'st-session-b', 'st-session-c', 'ST Explosive Lower', 'ST Upper & Reactive', 'ST Full Power'),
      week(6, 'Strength',    'st-session-b', 'st-session-c', 'st-session-a', 'ST Upper & Reactive', 'ST Full Power', 'ST Explosive Lower'),
      week(7, 'Power',       'st-session-a', 'st-session-b', 'st-session-c', 'ST Explosive Lower', 'ST Upper & Reactive', 'ST Full Power'),
      week(8, 'Peak',        'st-session-c', 'st-session-a', 'st-session-b', 'ST Full Power', 'ST Explosive Lower', 'ST Upper & Reactive'),
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

export function getCurrentPlanWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(diff, 7)); // 0-indexed, capped at 7 (week 8)
}

export function getWeekDates(weekOffset = 0): Date[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  // getDay() returns 0=Sun, 1=Mon ... shift so Monday=0
  monday.setDate(today.getDate() - ((day + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// Find a template by ID across position templates and built-in templates
export function findTemplate(id: string): BuiltInTemplate | undefined {
  return POSITION_TEMPLATES.find(t => t.id === id);
}
