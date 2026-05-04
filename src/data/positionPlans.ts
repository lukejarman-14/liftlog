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
// HPP hierarchy: Max Velocity → Max Strength → Tendon Stiffness → Eccentric → Isometric → Conditioning

export const POSITION_TEMPLATES: BuiltInTemplate[] = [

  // ── GOALKEEPER ──────────────────────────────────────────────────────────
  {
    id: 'gk-session-a', name: 'GK — Reactive Power', description: 'Vertical jumps, upper body strength, reactive plyos, calf eccentrics, shoulder isometrics, shuttle conditioning.',
    program: 'Goalkeeper', exercises: [
      // 1 — Max Velocity
      ex('approach-jump',        4, 5,  0,  120), ex('box-jump',          3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          4, 6,  65, 180), ex('barbell-row',       4, 6,  55, 180), ex('ohp', 3, 8, 40, 150), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('lateral-box-jump',  3, 8,  0,  90),  ex('pogo-jump', 3, 20, 0, 60),
      // 4 — Eccentric
      ex('eccentric-calf-raise', 3, 12, 0,  90),  ex('eccentric-nordic',  3, 2,  0,  120),
      // 5 — Isometric
      ex('dead-hang',            3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('shuttle-run',          4, 1,  0,  60),
    ],
  },
  {
    id: 'gk-session-b', name: 'GK — Lower Power', description: 'Broad jumps, squat-based strength, lateral tendon stiffness, hamstring eccentrics, hip isometrics, shuttle conditioning.',
    program: 'Goalkeeper', exercises: [
      // 1 — Max Velocity
      ex('broad-jump',           4, 5,  0,  120), ex('approach-jump',     3, 5,  0,  120),
      // 2 — Max Strength
      ex('squat',                4, 6,  80, 240), ex('rdl',               3, 8,  65, 180), ex('hip-thrust', 3, 10, 75, 120),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('skater-jump',       3, 10, 0,  90),  ex('pogo-jump', 3, 20, 0, 60),
      // 4 — Eccentric
      ex('eccentric-sl-rdl',     3, 8,  0,  90),  ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('glute-bridge-hold',    2, 1,  0,  60),  ex('wall-sit',          2, 1,  0,  60),
      // 6 — Conditioning
      ex('shuttle-run',          5, 1,  0,  60),
    ],
  },
  {
    id: 'gk-session-c', name: 'GK — Full Body Power', description: 'Drop jumps, full posterior chain, reactive plyos, eccentric circuit, core isometrics, repeated sprint conditioning.',
    program: 'Goalkeeper', exercises: [
      // 1 — Max Velocity
      ex('box-jump',             4, 5,  0,  120), ex('depth-jump',        3, 5,  0,  150),
      // 2 — Max Strength
      ex('deadlift',             3, 5,  95, 240), ex('front-squat',       3, 6,  60, 180),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('lateral-box-jump',  3, 8,  0,  90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      5, 1,  0,  30),
    ],
  },

  // ── CENTRE BACK ─────────────────────────────────────────────────────────
  {
    id: 'cb-session-a', name: 'CB — Aerial Power', description: 'Vertical and broad jumps, heavy compound strength, tendon stiffness plyos, hamstring eccentrics, hip isometrics, sprint conditioning.',
    program: 'Centre Back', exercises: [
      // 1 — Max Velocity
      ex('approach-jump',        4, 5,  0,  120), ex('box-jump',          3, 5,  0,  120), ex('broad-jump', 3, 5, 0, 120),
      // 2 — Max Strength
      ex('squat',                5, 5,  90, 240), ex('deadlift',          4, 4,  110,240), ex('hip-thrust', 3, 8, 90, 120),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('lateral-bound',     3, 8,  0,  90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('glute-bridge-hold',    2, 1,  0,  60),  ex('wall-sit',          2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      6, 1,  0,  30),
    ],
  },
  {
    id: 'cb-session-b', name: 'CB — Upper Strength', description: 'Jumps, upper body dominance, reactive plyos, hamstring eccentrics, core stability, shuttle conditioning.',
    program: 'Centre Back', exercises: [
      // 1 — Max Velocity
      ex('box-jump',             3, 5,  0,  120), ex('broad-jump',        3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          4, 6,  70, 180), ex('barbell-row',       4, 6,  60, 180), ex('ohp', 3, 8, 45, 150), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('pogo-jump',         3, 20, 0,  60),  ex('lateral-bound', 3, 8, 0, 90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('dead-hang',            3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('shuttle-run',          4, 1,  0,  60),
    ],
  },
  {
    id: 'cb-session-c', name: 'CB — Full Power', description: 'Drop jumps, bounding, posterior chain strength, reactive plyos, full eccentric circuit, core isometrics, repeated sprints.',
    program: 'Centre Back', exercises: [
      // 1 — Max Velocity
      ex('depth-jump',           4, 5,  0,  150), ex('approach-jump',     3, 5,  0,  120), ex('hurdle-hop', 3, 8, 0, 90),
      // 2 — Max Strength
      ex('front-squat',          3, 6,  70, 180), ex('rdl',               3, 8,  70, 180),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('lateral-bound',     3, 8,  0,  90),  ex('skater-jump', 3, 10, 0, 90),
      // 4 — Eccentric
      ex('eccentric-sl-rdl',     3, 8,  0,  90),  ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      6, 1,  0,  30),
    ],
  },

  // ── FULL BACK ────────────────────────────────────────────────────────────
  {
    id: 'fb-pos-session-a', name: 'FB — Lateral Speed', description: 'Sprints, broad jumps and bounding, balanced lower strength, lateral tendon stiffness, calf eccentrics, hip isometrics, shuttle conditioning.',
    program: 'Full Back', exercises: [
      // 1 — Max Velocity
      ex('sprint',               4, 1,  0,  180), ex('broad-jump',        4, 5,  0,  120), ex('bounding', 3, 8, 0, 120),
      // 2 — Max Strength
      ex('squat',                4, 6,  82, 240), ex('rdl',               3, 8,  68, 180), ex('hip-thrust', 3, 10, 80, 120), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('skater-jump',       3, 10, 0,  90),  ex('pogo-jump', 3, 20, 0, 60),
      // 4 — Eccentric
      ex('eccentric-calf-raise', 3, 12, 0,  90),  ex('eccentric-sl-rdl',  3, 8,  0,  90),
      // 5 — Isometric
      ex('side-plank',           3, 1,  0,  60),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('shuttle-run',          6, 1,  0,  45),
    ],
  },
  {
    id: 'fb-pos-session-b', name: 'FB — Upper & Power', description: 'Box jumps, upper body strength, reactive plyos, hamstring/calf eccentrics, core stability, tempo conditioning.',
    program: 'Full Back', exercises: [
      // 1 — Max Velocity
      ex('box-jump',             4, 5,  0,  120), ex('approach-jump',     3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          3, 8,  62, 150), ex('barbell-row',       3, 8,  55, 150), ex('ohp', 3, 10, 40, 120), ex('chin-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('reactive-drop-jump', 3, 5, 0, 150),  ex('lateral-bound', 3, 8, 0, 90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('side-plank',           3, 1,  0,  60),  ex('calf-raise-hold',   2, 1,  0,  45),
      // 6 — Conditioning
      ex('tempo-run',            5, 1,  0,  90),
    ],
  },
  {
    id: 'fb-pos-session-c', name: 'FB — Full Body Endurance Power', description: 'Broad jumps and bounding, full posterior chain, tendon stiffness, eccentric circuit, core isometrics, repeated sprint conditioning.',
    program: 'Full Back', exercises: [
      // 1 — Max Velocity
      ex('broad-jump',           4, 5,  0,  120), ex('bounding',          3, 8,  0,  120), ex('hurdle-hop', 3, 8, 0, 90),
      // 2 — Max Strength
      ex('deadlift',             3, 5,  95, 240), ex('front-squat',       3, 6,  62, 180),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('skater-jump',       3, 10, 0,  90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('calf-raise-hold',   2, 1,  0,  45),
      // 6 — Conditioning
      ex('repeated-sprint',      8, 1,  0,  30),
    ],
  },

  // ── CENTRAL MIDFIELDER ───────────────────────────────────────────────────
  {
    id: 'cm-session-a', name: 'CM — Lower Endurance Power', description: 'Broad jumps and hurdle hops, balanced lower strength, tendon stiffness plyos, hamstring eccentrics, core isometrics, HIIT conditioning.',
    program: 'Central Midfielder', exercises: [
      // 1 — Max Velocity
      ex('broad-jump',           4, 5,  0,  120), ex('hurdle-hop',        3, 8,  0,  90),
      // 2 — Max Strength
      ex('squat',                4, 6,  80, 240), ex('rdl',               3, 8,  65, 180), ex('hip-thrust', 3, 10, 78, 120),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('lateral-bound',     3, 8,  0,  90),  ex('skater-jump', 3, 10, 0, 90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('wall-sit',             2, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('hiit-run',             8, 1,  0,  30),
    ],
  },
  {
    id: 'cm-session-b', name: 'CM — Upper & Reactive', description: 'Box jumps, upper body strength, reactive plyos, calf eccentrics, core stability, HIIT conditioning.',
    program: 'Central Midfielder', exercises: [
      // 1 — Max Velocity
      ex('box-jump',             3, 5,  0,  120), ex('broad-jump',        3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          3, 8,  62, 150), ex('barbell-row',       3, 8,  55, 150), ex('ohp', 3, 10, 40, 120), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('pogo-jump',         3, 20, 0,  60),  ex('skater-jump', 3, 10, 0, 90),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('side-plank',           3, 1,  0,  60),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('hiit-run',             6, 1,  0,  30),
    ],
  },
  {
    id: 'cm-session-c', name: 'CM — Full Body RSA', description: 'Broad jumps, bounding and hurdle hops, full posterior chain, tendon stiffness, eccentric circuit, core isometrics, repeated sprint ability.',
    program: 'Central Midfielder', exercises: [
      // 1 — Max Velocity
      ex('broad-jump',           4, 5,  0,  120), ex('bounding',          3, 8,  0,  120), ex('hurdle-hop', 3, 8, 0, 90),
      // 2 — Max Strength
      ex('deadlift',             3, 5,  95, 240), ex('front-squat',       3, 6,  62, 180),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('pogo-jump',         3, 20, 0,  60),
      // 4 — Eccentric
      ex('eccentric-sl-rdl',     3, 8,  0,  90),  ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('wall-sit',          2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      8, 1,  0,  30),
    ],
  },

  // ── WINGER ───────────────────────────────────────────────────────────────
  {
    id: 'w-session-a', name: 'Winger — Acceleration Power', description: 'Sprints, broad jumps and bounding, explosive lower strength, ankle tendon stiffness, calf eccentrics, ankle isometrics, sprint conditioning.',
    program: 'Winger', exercises: [
      // 1 — Max Velocity
      ex('sprint',               5, 1,  0,  180), ex('broad-jump',        4, 5,  0,  120), ex('bounding', 3, 8, 0, 120),
      // 2 — Max Strength
      ex('squat',                4, 5,  85, 240), ex('rdl',               3, 8,  68, 180), ex('hip-thrust', 3, 10, 80, 120),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('ankle-hop',         3, 20, 0,  60),  ex('lateral-bound', 3, 8, 0, 90),
      // 4 — Eccentric
      ex('eccentric-calf-raise', 3, 12, 0,  90),  ex('eccentric-nordic',  3, 2,  0,  120),
      // 5 — Isometric
      ex('calf-raise-hold',      3, 1,  0,  45),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      6, 1,  0,  30),
    ],
  },
  {
    id: 'w-session-b', name: 'Winger — Lateral & Reactive', description: 'Approach and broad jumps, upper body strength, lateral tendon stiffness, hamstring eccentrics, core stability, shuttle conditioning.',
    program: 'Winger', exercises: [
      // 1 — Max Velocity
      ex('approach-jump',        4, 5,  0,  120), ex('broad-jump',        3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          3, 8,  60, 150), ex('barbell-row',       3, 8,  52, 150), ex('ohp', 3, 10, 38, 120), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('skater-jump',       3, 10, 0,  90),  ex('reactive-drop-jump', 3, 5, 0, 150),
      // 4 — Eccentric
      ex('eccentric-sl-rdl',     3, 8,  0,  90),  ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('side-plank',           3, 1,  0,  60),  ex('calf-raise-hold',   2, 1,  0,  45),
      // 6 — Conditioning
      ex('shuttle-run',          5, 1,  0,  45),
    ],
  },
  {
    id: 'w-session-c', name: 'Winger — Full Explosive', description: 'Sprints, drop jumps and bounding, full compound strength, reactive plyos, eccentric circuit, core isometrics, tempo conditioning.',
    program: 'Winger', exercises: [
      // 1 — Max Velocity
      ex('sprint',               5, 1,  0,  180), ex('depth-jump',        4, 5,  0,  150), ex('approach-jump', 3, 5, 0, 120), ex('bounding', 3, 8, 0, 120),
      // 2 — Max Strength
      ex('deadlift',             3, 5,  98, 240), ex('squat',             3, 5,  85, 240),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('reactive-drop-jump', 3, 5, 0, 150),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('tempo-run',            5, 1,  0,  90),
    ],
  },

  // ── STRIKER ──────────────────────────────────────────────────────────────
  {
    id: 'st-session-a', name: 'Striker — Explosive Lower', description: 'Approach jumps, drop jumps and broad jumps, power-focused lower strength, reactive plyos, hamstring eccentrics, power isometrics, sprint conditioning.',
    program: 'Striker', exercises: [
      // 1 — Max Velocity
      ex('approach-jump',        4, 5,  0,  120), ex('depth-jump',        3, 5,  0,  150), ex('broad-jump', 3, 5, 0, 120),
      // 2 — Max Strength
      ex('squat',                4, 5,  88, 240), ex('rdl',               3, 8,  72, 180), ex('hip-thrust', 3, 8, 88, 120),
      // 3 — Tendon Stiffness
      ex('pogo-jump',            3, 20, 0,  60),  ex('reactive-drop-jump', 3, 5, 0, 150),
      // 4 — Eccentric
      ex('eccentric-nordic',     3, 2,  0,  120), ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('wall-sit',             3, 1,  0,  60),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      6, 1,  0,  30),
    ],
  },
  {
    id: 'st-session-b', name: 'Striker — Upper & Reactive', description: 'Box and broad jumps, upper body strength for hold-up play, reactive plyos, calf eccentrics, core stability, repeated sprint conditioning.',
    program: 'Striker', exercises: [
      // 1 — Max Velocity
      ex('box-jump',             4, 5,  0,  120), ex('broad-jump',        3, 5,  0,  120),
      // 2 — Max Strength
      ex('bench-press',          4, 6,  68, 180), ex('barbell-row',       4, 6,  58, 180), ex('ohp', 3, 8, 42, 150), ex('pull-up', 3, 8, 0, 120),
      // 3 — Tendon Stiffness
      ex('reactive-drop-jump',   3, 5,  0,  150), ex('lateral-bound',     3, 8,  0,  90),  ex('pogo-jump', 3, 20, 0, 60),
      // 4 — Eccentric
      ex('eccentric-calf-raise', 3, 12, 0,  90),  ex('eccentric-nordic',  3, 2,  0,  120),
      // 5 — Isometric
      ex('dead-hang',            3, 1,  0,  60),  ex('side-plank',        2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      6, 1,  0,  30),
    ],
  },
  {
    id: 'st-session-c', name: 'Striker — Full Power', description: 'Broad jumps, bounding and hurdle hops, full posterior chain, lateral tendon stiffness, eccentric circuit, core isometrics, repeated sprint conditioning.',
    program: 'Striker', exercises: [
      // 1 — Max Velocity
      ex('broad-jump',           4, 5,  0,  120), ex('bounding',          3, 8,  0,  120), ex('hurdle-hop', 3, 8, 0, 90),
      // 2 — Max Strength
      ex('deadlift',             3, 5,  100,240), ex('front-squat',       3, 6,  68, 180),
      // 3 — Tendon Stiffness
      ex('lateral-bound',        3, 8,  0,  90),  ex('skater-jump',       3, 10, 0,  90),
      // 4 — Eccentric
      ex('eccentric-sl-rdl',     3, 8,  0,  90),  ex('eccentric-calf-raise', 3, 12, 0, 90),
      // 5 — Isometric
      ex('copenhagen-plank',     3, 1,  0,  60),  ex('glute-bridge-hold', 2, 1,  0,  60),
      // 6 — Conditioning
      ex('repeated-sprint',      8, 1,  0,  30),
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
    description: 'Top-end speed, acceleration and explosive 1v1 ability. Sprint-focused plyometrics, calf/Achilles resilience.',
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
    description: 'Explosive first step, aerial power and hold-up strength. Full-body power, vertical jump development and sprint conditioning throughout.',
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
