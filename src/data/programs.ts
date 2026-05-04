import { WorkoutExercise } from '../types';

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  program: string;
  exercises: WorkoutExercise[];
}

export interface Program {
  name: string;
  description: string;
  sport?: 'football' | 'general';
  templates: BuiltInTemplate[];
}

function ex(
  exerciseId: string,
  targetSets: number,
  targetReps: number,
  targetWeight: number,
  restSeconds: number,
): WorkoutExercise {
  return { exerciseId, targetSets, targetReps, targetWeight, restSeconds };
}

export const BUILT_IN_PROGRAMS: Program[] = [
  {
    name: 'Push / Pull / Legs',
    description: '3-day split hitting every muscle twice a week. Great for intermediate lifters.',
    templates: [
      {
        id: 'ppl-push',
        name: 'Push Day',
        description: 'Chest, shoulders & triceps',
        program: 'Push / Pull / Legs',
        exercises: [
          ex('bench-press',   4, 8,  60, 180),
          ex('ohp',           3, 10, 40, 180),
          ex('incline-bench', 3, 10, 50, 120),
          ex('lateral-raise', 4, 15, 10, 60),
          ex('tricep-pushdown', 3, 12, 25, 60),
          ex('skull-crusher', 3, 10, 30, 90),
        ],
      },
      {
        id: 'ppl-pull',
        name: 'Pull Day',
        description: 'Back & biceps',
        program: 'Push / Pull / Legs',
        exercises: [
          ex('deadlift',      3, 5,  100, 240),
          ex('pull-up',       4, 8,  0,   120),
          ex('barbell-row',   4, 8,  60,  180),
          ex('face-pull',     3, 15, 20,  60),
          ex('barbell-curl',  3, 12, 30,  90),
          ex('hammer-curl',   3, 12, 15,  60),
        ],
      },
      {
        id: 'ppl-legs',
        name: 'Leg Day',
        description: 'Quads, hamstrings, glutes & calves',
        program: 'Push / Pull / Legs',
        exercises: [
          ex('squat',        4, 8,  80,  240),
          ex('rdl',          3, 10, 60,  180),
          ex('leg-press',    3, 12, 120, 150),
          ex('leg-curl',     3, 12, 40,  90),
          ex('hip-thrust',   3, 10, 80,  120),
          ex('calf-raise',   4, 15, 60,  60),
        ],
      },
    ],
  },
  {
    name: 'Upper / Lower',
    description: '4-day split focusing on upper and lower body on alternating days.',
    templates: [
      {
        id: 'ul-upper-a',
        name: 'Upper A — Strength',
        description: 'Heavy upper body — bench, rows, press',
        program: 'Upper / Lower',
        exercises: [
          ex('bench-press',    4, 6,  70, 180),
          ex('barbell-row',    4, 6,  60, 180),
          ex('ohp',            3, 8,  45, 150),
          ex('pull-up',        3, 8,  0,  120),
          ex('barbell-curl',   2, 10, 30, 90),
          ex('tricep-pushdown',2, 10, 25, 60),
        ],
      },
      {
        id: 'ul-upper-b',
        name: 'Upper B — Volume',
        description: 'Higher reps, more volume',
        program: 'Upper / Lower',
        exercises: [
          ex('incline-bench',  4, 10, 55, 120),
          ex('cable-row',      4, 12, 50, 90),
          ex('db-ohp',         3, 12, 20, 90),
          ex('lat-pulldown',   3, 12, 50, 90),
          ex('db-curl',        3, 15, 12, 60),
          ex('overhead-tri-ext',3,15, 15, 60),
        ],
      },
      {
        id: 'ul-lower-a',
        name: 'Lower A — Strength',
        description: 'Squat-focused heavy lower',
        program: 'Upper / Lower',
        exercises: [
          ex('squat',          4, 6,  90,  240),
          ex('rdl',            3, 8,  70,  180),
          ex('leg-press',      3, 10, 130, 150),
          ex('leg-curl',       3, 10, 45,  90),
          ex('calf-raise',     4, 12, 60,  60),
        ],
      },
      {
        id: 'ul-lower-b',
        name: 'Lower B — Volume',
        description: 'Hip-hinge focus, higher reps',
        program: 'Upper / Lower',
        exercises: [
          ex('deadlift',       3, 5,  110, 240),
          ex('front-squat',    3, 10, 60,  180),
          ex('lunge',          3, 12, 20,  90),
          ex('leg-extension',  3, 15, 40,  60),
          ex('hip-thrust',     4, 12, 80,  120),
          ex('calf-raise',     3, 20, 40,  45),
        ],
      },
    ],
  },
  {
    name: 'Strength (5×5)',
    description: 'Classic strength programme. Add weight every session.',
    templates: [
      {
        id: 'strength-a',
        name: 'Workout A',
        description: 'Squat, bench, row',
        program: 'Strength (5×5)',
        exercises: [
          ex('squat',       5, 5, 80, 240),
          ex('bench-press', 5, 5, 60, 180),
          ex('barbell-row', 5, 5, 50, 180),
        ],
      },
      {
        id: 'strength-b',
        name: 'Workout B',
        description: 'Squat, overhead press, deadlift',
        program: 'Strength (5×5)',
        exercises: [
          ex('squat',    5, 5, 80,  240),
          ex('ohp',      5, 5, 40,  180),
          ex('deadlift', 1, 5, 100, 300),
        ],
      },
    ],
  },
  {
    name: 'Hypertrophy',
    description: 'High-volume, muscle-building splits. 8–15 rep ranges throughout.',
    templates: [
      {
        id: 'hyp-chest-tri',
        name: 'Chest & Triceps',
        description: 'Volume chest and triceps session',
        program: 'Hypertrophy',
        exercises: [
          ex('bench-press',     4, 10, 60,  120),
          ex('incline-bench',   3, 12, 50,  90),
          ex('db-fly',          3, 15, 14,  60),
          ex('chest-dip',       3, 12, 0,   90),
          ex('skull-crusher',   3, 12, 25,  60),
          ex('tricep-pushdown', 3, 15, 22,  60),
        ],
      },
      {
        id: 'hyp-back-bi',
        name: 'Back & Biceps',
        description: 'Volume back and biceps session',
        program: 'Hypertrophy',
        exercises: [
          ex('pull-up',        4, 10, 0,  120),
          ex('barbell-row',    4, 10, 55, 120),
          ex('lat-pulldown',   3, 12, 50, 90),
          ex('cable-row',      3, 12, 45, 90),
          ex('barbell-curl',   3, 12, 28, 90),
          ex('hammer-curl',    3, 15, 12, 60),
        ],
      },
      {
        id: 'hyp-shoulders',
        name: 'Shoulders & Arms',
        description: 'Delts, biceps and triceps',
        program: 'Hypertrophy',
        exercises: [
          ex('db-ohp',          4, 12, 20, 120),
          ex('lateral-raise',   4, 15, 10, 60),
          ex('rear-delt-fly',   3, 15, 10, 60),
          ex('shrug',           3, 15, 60, 60),
          ex('barbell-curl',    3, 12, 28, 90),
          ex('overhead-tri-ext',3, 12, 20, 60),
        ],
      },
      {
        id: 'hyp-legs',
        name: 'Legs — Hypertrophy',
        description: 'High-volume legs',
        program: 'Hypertrophy',
        exercises: [
          ex('squat',          4, 10, 70,  180),
          ex('rdl',            4, 12, 60,  120),
          ex('leg-press',      4, 15, 110, 120),
          ex('leg-curl',       3, 15, 40,  60),
          ex('leg-extension',  3, 15, 40,  60),
          ex('calf-raise',     4, 20, 50,  45),
        ],
      },
    ],
  },
  {
    name: 'Plyometric Power',
    description: 'Explosive power and speed development. Low reps, full recovery.',
    templates: [
      {
        id: 'plyo-lower',
        name: 'Lower Body Power',
        description: 'Jumps, bounds and sprints',
        program: 'Plyometric Power',
        exercises: [
          ex('sprint',        5, 1, 0, 180),
          ex('box-jump',      4, 5, 0, 120),
          ex('depth-jump',    3, 5, 0, 120),
          ex('broad-jump',    4, 5, 0, 120),
          ex('hurdle-hop',    3, 8, 0, 90),
          ex('skater-jump',   3, 8, 0, 90),
        ],
      },
      {
        id: 'plyo-upper',
        name: 'Reactive Power',
        description: 'Reactive drop jumps, bounding and tendon stiffness work',
        program: 'Plyometric Power',
        exercises: [
          ex('reactive-drop-jump', 4, 5, 0, 150),
          ex('lateral-box-jump',   4, 8, 0, 90),
          ex('bounding',           4, 8, 0, 120),
          ex('lateral-bound',      3, 8, 0, 90),
          ex('pogo-jump',          3, 20, 0, 60),
          ex('ankle-hop',          3, 20, 0, 60),
        ],
      },
      {
        id: 'plyo-full',
        name: 'Full Body Power',
        description: 'Total body explosiveness — sprints, jumps, bounds',
        program: 'Plyometric Power',
        exercises: [
          ex('sprint',          4, 1, 0, 180),
          ex('box-jump',        4, 5, 0, 120),
          ex('depth-jump',      3, 5, 0, 150),
          ex('approach-jump',   3, 5, 0, 120),
          ex('hurdle-hop',      3, 8, 0, 90),
          ex('broad-jump',      3, 5, 0, 120),
        ],
      },
    ],
  },
  {
    name: 'Full Body',
    description: '3-day full body workouts, ideal for beginners or time-crunched athletes.',
    templates: [
      {
        id: 'fb-a',
        name: 'Full Body A',
        description: 'Squat, push, pull pattern',
        program: 'Full Body',
        exercises: [
          ex('squat',       3, 8,  70, 180),
          ex('bench-press', 3, 8,  55, 150),
          ex('barbell-row', 3, 8,  50, 150),
          ex('ohp',         2, 10, 35, 120),
          ex('plank',       3, 1,  0,  60),
        ],
      },
      {
        id: 'fb-b',
        name: 'Full Body B',
        description: 'Deadlift, press, chin-up pattern',
        program: 'Full Body',
        exercises: [
          ex('deadlift',    3, 5,  90, 240),
          ex('incline-bench',3,10, 50, 150),
          ex('chin-up',     3, 8,  0,  120),
          ex('lateral-raise',3,15, 8,  60),
          ex('ab-wheel',    3, 10, 0,  60),
        ],
      },
      {
        id: 'fb-c',
        name: 'Full Body C',
        description: 'Front squat, dip, row variation',
        program: 'Full Body',
        exercises: [
          ex('front-squat', 3, 8,  55, 180),
          ex('chest-dip',   3, 10, 0,  120),
          ex('cable-row',   3, 12, 45, 90),
          ex('db-ohp',      3, 12, 18, 90),
          ex('hanging-leg-raise',3,10,0, 60),
        ],
      },
    ],
  },
];

// ── Football-specific programs ────────────────────────────────────────────

export const FOOTBALL_PROGRAMS: Program[] = [
  {
    name: 'Footballer Weekly Sessions',
    description: '3 complete sessions per week. Each follows the HPP hierarchy: Max Velocity → Max Strength → Tendon Stiffness → Eccentric → Isometric → Conditioning. Rotate through all three across the week.',
    sport: 'football',
    templates: [
      {
        id: 'fb-weekly-session1',
        name: 'Session 1 — Lower Power',
        description: 'Broad jumps, squat-based strength, tendon stiffness plyos, hamstring eccentrics, hip isometrics, then repeated sprints.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          // 1 — Max Velocity
          ex('broad-jump',           4, 5,  0,   120),
          ex('box-jump',             3, 5,  0,   120),
          // 2 — Max Strength
          ex('squat',                4, 6,  85,  240),
          ex('rdl',                  3, 8,  70,  180),
          ex('hip-thrust',           3, 10, 80,  120),
          // 3 — Tendon Stiffness
          ex('lateral-bound',        3, 8,  0,   90),
          ex('pogo-jump',            3, 20, 0,   60),
          // 4 — Eccentric
          ex('eccentric-nordic',     3, 2,  0,   120),
          ex('eccentric-calf-raise', 3, 12, 0,   90),
          // 5 — Isometric
          ex('glute-bridge-hold',    3, 1,  0,   60),
          ex('wall-sit',             2, 1,  0,   60),
          // 6 — Conditioning
          ex('repeated-sprint',      6, 1,  0,   30),
        ],
      },
      {
        id: 'fb-weekly-session2',
        name: 'Session 2 — Upper & Reactive',
        description: 'Jumps, upper body strength, reactive tendon stiffness plyos, hamstring/calf eccentrics, core isometrics, then interval conditioning.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          // 1 — Max Velocity
          ex('approach-jump',        3, 5,  0,   120),
          ex('box-jump',             3, 5,  0,   120),
          // 2 — Max Strength
          ex('bench-press',          4, 6,  70,  180),
          ex('barbell-row',          4, 6,  60,  180),
          ex('ohp',                  3, 8,  45,  150),
          ex('pull-up',              3, 8,  0,   120),
          // 3 — Tendon Stiffness
          ex('reactive-drop-jump',   3, 5,  0,   150),
          ex('pogo-jump',            3, 20, 0,   60),
          // 4 — Eccentric
          ex('eccentric-sl-rdl',     3, 8,  0,   90),
          ex('eccentric-calf-raise', 3, 12, 0,   90),
          // 5 — Isometric
          ex('dead-hang',            3, 1,  0,   60),
          ex('side-plank',           2, 1,  0,   60),
          // 6 — Conditioning
          ex('hiit-run',             8, 1,  0,   30),
        ],
      },
      {
        id: 'fb-weekly-session3',
        name: 'Session 3 — Full Body Power',
        description: 'Sprints, drop jumps, full posterior chain, lateral tendon stiffness, eccentric circuit, core isometrics, then match-tempo conditioning.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          // 1 — Max Velocity
          ex('sprint',               4, 1,  0,   180),
          ex('depth-jump',           4, 5,  0,   150),
          ex('approach-jump',        3, 5,  0,   120),
          // 2 — Max Strength
          ex('deadlift',             3, 5,  100, 240),
          ex('front-squat',          3, 6,  65,  180),
          // 3 — Tendon Stiffness
          ex('lateral-bound',        3, 8,  0,   90),
          ex('skater-jump',          3, 10, 0,   90),
          // 4 — Eccentric
          ex('eccentric-nordic',     3, 2,  0,   120),
          ex('eccentric-calf-raise', 3, 12, 0,   90),
          // 5 — Isometric
          ex('copenhagen-plank',     3, 1,  0,   60),
          ex('glute-bridge-hold',    2, 1,  0,   60),
          // 6 — Conditioning
          ex('shuttle-run',          5, 1,  0,   60),
        ],
      },
    ],
  },
  {
    name: 'Football Plyometrics',
    description: 'Explosive power, acceleration and reactive ability — sequenced to build from foundation to sport-specific.',
    sport: 'football',
    templates: [
      {
        id: 'fb-plyo-foundation',
        name: 'Foundation — Ankle & Calf Stiffness',
        description: 'Tendon loading, pogo work, reactive ground contact. Start every plyo block here.',
        program: 'Football Plyometrics',
        exercises: [
          ex('pogo-jump',      4, 20, 0, 60),
          ex('ankle-hop',      4, 20, 0, 60),
          ex('box-jump',       4, 5,  0, 90),
          ex('broad-jump',     4, 5,  0, 120),
          ex('calf-raise',     3, 20, 0, 60),
        ],
      },
      {
        id: 'fb-plyo-horizontal',
        name: 'Horizontal Power — Speed & Bounds',
        description: 'Acceleration mechanics, horizontal bounding, sprint starts.',
        program: 'Football Plyometrics',
        exercises: [
          ex('sprint',         6, 1,  0, 180),
          ex('broad-jump',     5, 5,  0, 120),
          ex('lateral-bound',  4, 8,  0, 90),
          ex('bounding',       4, 8,  0, 120),
          ex('hurdle-hop',     3, 8,  0, 90),
        ],
      },
      {
        id: 'fb-plyo-vertical',
        name: 'Vertical Power — Jump Height',
        description: 'CMJ development, depth jumps, approach jumps for aerial duels.',
        program: 'Football Plyometrics',
        exercises: [
          ex('box-jump',       4, 5,  0, 120),
          ex('depth-jump',     4, 5,  0, 150),
          ex('approach-jump',  4, 5,  0, 120),
          ex('hurdle-hop',     3, 8,  0, 90),
          ex('single-leg-hop', 3, 8,  0, 90),
        ],
      },
      {
        id: 'fb-plyo-reactive',
        name: 'Reactive Tendon Stiffness',
        description: 'Reactive ground contact, lateral stiffness and ankle spring — builds the elastic energy system.',
        program: 'Football Plyometrics',
        exercises: [
          ex('reactive-drop-jump', 4, 5,  0, 150),
          ex('lateral-box-jump',   4, 8,  0, 90),
          ex('skater-jump',        4, 10, 0, 90),
          ex('lateral-bound',      3, 8,  0, 90),
          ex('pogo-jump',          3, 20, 0, 60),
          ex('ankle-hop',          3, 20, 0, 60),
        ],
      },
    ],
  },
  {
    name: 'Football Strength',
    description: 'Strength phases for footballers — run these year-round. Rotate between phases every 4–6 weeks to keep progressing without losing adaptation.',
    sport: 'football',
    templates: [
      {
        id: 'fb-str-lower-hyp',
        name: 'Lower Body — Hypertrophy Phase',
        description: 'Volume base. 8–12 reps, moderate load. Build muscle and work capacity.',
        program: 'Football Strength',
        exercises: [
          ex('squat',        4, 10, 70,  150),
          ex('rdl',          4, 10, 60,  120),
          ex('leg-press',    3, 12, 100, 90),
          ex('nordic-curl',  3, 8,  0,   120),
          ex('hip-thrust',   4, 12, 70,  90),
          ex('calf-raise',   4, 15, 40,  45),
        ],
      },
      {
        id: 'fb-str-lower-str',
        name: 'Lower Body — Strength Phase',
        description: 'Heavy loading. 3–6 reps, high intensity. Build maximal force output.',
        program: 'Football Strength',
        exercises: [
          ex('squat',        5, 5,  90,  240),
          ex('deadlift',     4, 4,  110, 240),
          ex('rdl',          3, 6,  80,  180),
          ex('nordic-curl',  4, 6,  0,   120),
          ex('hip-thrust',   4, 8,  90,  120),
          ex('calf-raise',   3, 12, 60,  60),
        ],
      },
      {
        id: 'fb-str-lower-power',
        name: 'Lower Body — Power Phase',
        description: 'Low reps, explosive intent. Convert strength into speed and power on the pitch.',
        program: 'Football Strength',
        exercises: [
          ex('sprint',       4, 1,  0,   180),
          ex('box-jump',     4, 5,  0,   120),
          ex('broad-jump',   3, 5,  0,   120),
          ex('squat',        4, 3,  95,  240),
          ex('hip-thrust',   4, 5,  100, 120),
        ],
      },
      {
        id: 'fb-str-upper',
        name: 'Upper Body — Strength & Power',
        description: 'Upper body pressing, pulling and shoulder resilience for football.',
        program: 'Football Strength',
        exercises: [
          ex('bench-press',    4, 6,  70,  180),
          ex('barbell-row',    4, 6,  60,  180),
          ex('ohp',            3, 8,  45,  150),
          ex('pull-up',        4, 8,  0,   120),
          ex('face-pull',      3, 15, 20,  60),
          ex('barbell-curl',   2, 12, 30,  90),
          ex('tricep-pushdown',2, 12, 25,  60),
        ],
      },
      {
        id: 'fb-str-maintenance',
        name: 'Strength Maintenance',
        description: 'Minimal effective dose — keeps all adaptations with reduced volume. Use during congested fixture periods or alongside heavy pitch load.',
        program: 'Football Strength',
        exercises: [
          ex('squat',        2, 5,  90,  240),
          ex('rdl',          2, 5,  80,  180),
          ex('bench-press',  2, 5,  70,  180),
          ex('barbell-row',  2, 5,  60,  180),
          ex('nordic-curl',  2, 6,  0,   120),
          ex('hip-thrust',   2, 8,  90,  120),
        ],
      },
    ],
  },
  {
    name: 'Injury Prevention',
    description: 'Eccentric and isometric loading targeting the most common football injuries: hamstrings, adductors, knees and ankles.',
    sport: 'football',
    templates: [
      {
        id: 'fb-inj-hamstring',
        name: 'Hamstring Protocol',
        description: 'Nordic-based eccentric loading. Run 2–3x per week year-round.',
        program: 'Injury Prevention',
        exercises: [
          ex('eccentric-nordic',   3, 2,  0, 120),
          ex('eccentric-calf-raise', 3, 12, 0, 90),
          ex('rdl',                3, 10, 50, 90),
          ex('hip-thrust',         3, 10, 60, 90),
          ex('glute-bridge-hold',  3, 1,  0, 60),
        ],
      },
      {
        id: 'fb-inj-adductor',
        name: 'Adductor / Groin Protocol',
        description: 'Copenhagen progressions and adductor loading. Key for groin injury prevention.',
        program: 'Injury Prevention',
        exercises: [
          ex('copenhagen-adductor',  4, 8,  0, 90),
          ex('copenhagen-plank',     3, 1,  0, 60),
          ex('lateral-band-walk',    3, 20, 0, 60),
          ex('side-plank',           3, 1,  0, 60),
        ],
      },
      {
        id: 'fb-inj-knee',
        name: 'Knee / VMO Protocol',
        description: 'Quad dominance and VMO activation. Good for ACL prevention and return to play.',
        program: 'Injury Prevention',
        exercises: [
          ex('reverse-nordic',      3, 8,  0, 90),
          ex('eccentric-sl-rdl',    3, 8,  0, 90),
          ex('leg-extension',       3, 15, 30, 60),
          ex('single-leg-hop',      3, 8,  0, 90),
          ex('lunge',               3, 12, 20, 90),
          ex('wall-sit',            3, 1,  0, 60),
        ],
      },
      {
        id: 'fb-inj-ankle',
        name: 'Ankle / Achilles Protocol',
        description: 'Eccentric calf loading for Achilles tendon health. Critical for high mileage players.',
        program: 'Injury Prevention',
        exercises: [
          ex('eccentric-calf-raise', 4, 15, 0, 90),
          ex('calf-raise-hold',      3, 1,  0, 45),
          ex('pogo-jump',            3, 20, 0, 60),
          ex('ankle-hop',            3, 20, 0, 60),
        ],
      },
      {
        id: 'fb-inj-hip-flexor',
        name: 'Hip Flexor Protocol',
        description: 'Hip flexor and glute eccentric/isometric loading. Reduces strain from repeated kicking.',
        program: 'Injury Prevention',
        exercises: [
          ex('eccentric-sl-rdl',     4, 8,  0, 90),
          ex('iso-lunge-hold',       3, 1,  0, 60),
          ex('hanging-leg-raise',    3, 12, 0, 60),
          ex('glute-bridge-hold',    3, 1,  0, 60),
          ex('plank',                3, 1,  0, 60),
        ],
      },
      {
        id: 'fb-inj-full',
        name: 'Full Prevention Circuit',
        description: 'All-round daily injury prevention. 20 minutes, 3–5x per week.',
        program: 'Injury Prevention',
        exercises: [
          ex('eccentric-nordic',     3, 2,  0, 120),
          ex('copenhagen-adductor',  2, 8,  0, 90),
          ex('eccentric-calf-raise', 2, 12, 0, 90),
          ex('copenhagen-plank',     2, 1,  0, 60),
          ex('side-plank',           2, 1,  0, 60),
        ],
      },
    ],
  },
  {
    name: 'Pre-Season Testing',
    description: 'Standardised assessment battery. Run at start and end of pre-season to measure progress.',
    sport: 'football',
    templates: [
      {
        id: 'test-sprint-battery',
        name: 'Sprint & Speed Testing',
        description: '3 trials each. Record best time. 3–4 min between sprints.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-5m-sprint',  3, 1, 0, 180),
          ex('test-10m-sprint', 3, 1, 0, 180),
          ex('test-20m-sprint', 3, 1, 0, 240),
          ex('test-30m-sprint', 3, 1, 0, 240),
        ],
      },
      {
        id: 'test-jump-battery',
        name: 'Jump & Power Testing',
        description: '3 trials each. Record best result. Full rest between efforts.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-cmj',         3, 1, 0, 120),
          ex('test-sqj',         3, 1, 0, 120),
          ex('test-drop-jump',   3, 1, 0, 120),
          ex('test-sl-cmj',      3, 1, 0, 120),
          ex('test-broad-jump',  3, 1, 0, 120),
          ex('test-triple-broad',2, 1, 0, 180),
          ex('test-rsi',         3, 1, 0, 120),
        ],
      },
      {
        id: 'test-agility-battery',
        name: 'Agility & COD Testing',
        description: 'Change of direction tests. 2–3 trials, best score recorded.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-505',      3, 1, 0, 180),
          ex('test-t-test',   2, 1, 0, 180),
          ex('test-illinois', 2, 1, 0, 180),
          ex('pro-agility',   3, 1, 0, 120),
        ],
      },
      {
        id: 'test-fitness-battery',
        name: 'Aerobic Fitness Testing',
        description: 'Maximal fitness tests. One attempt each. Full warm-up required.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-yoyo-ir1',  1, 1, 0, 0),
          ex('test-3015-ift',  1, 1, 0, 0),
          ex('test-beep-test', 1, 1, 0, 0),
        ],
      },
      {
        id: 'test-strength-battery',
        name: 'Strength Testing',
        description: '1RM and 3RM assessments. Allow 3–5 min between attempts.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-3rm-squat',    3, 3, 80,  240),
          ex('test-1rm-squat',    3, 1, 100, 300),
          ex('test-1rm-deadlift', 3, 1, 110, 300),
          ex('test-1rm-bench',    3, 1, 80,  240),
          ex('test-imtp',         3, 1, 0,   180),
        ],
      },
      {
        id: 'test-full-preseason',
        name: 'Full Pre-Season Battery',
        description: 'Complete assessment day. Allow 3–4 hours total. Sequence: strength → jumps → sprints → fitness.',
        program: 'Pre-Season Testing',
        exercises: [
          ex('test-1rm-squat',    2, 1, 100, 300),
          ex('test-cmj',          3, 1, 0,   120),
          ex('test-broad-jump',   3, 1, 0,   120),
          ex('test-10m-sprint',   3, 1, 0,   180),
          ex('test-30m-sprint',   3, 1, 0,   240),
          ex('test-505',          3, 1, 0,   180),
          ex('test-yoyo-ir1',     1, 1, 0,   0),
        ],
      },
    ],
  },
  {
    name: 'Football Conditioning',
    description: 'Energy system development specific to football — from aerobic base through to repeated sprint ability.',
    sport: 'football',
    templates: [
      {
        id: 'fb-cond-aerobic-base',
        name: 'Aerobic Base',
        description: 'Low-intensity steady state. Heart rate 65–75% max. Early pre-season block.',
        program: 'Football Conditioning',
        exercises: [
          ex('aerobic-threshold-run', 1, 1, 0, 0),
          ex('tempo-run',             4, 1, 0, 120),
        ],
      },
      {
        id: 'fb-cond-lactate',
        name: 'Lactate Threshold Development',
        description: 'Tempo efforts at 80–85% max HR. Builds engine for high-intensity play.',
        program: 'Football Conditioning',
        exercises: [
          ex('lactate-threshold-run', 1, 1, 0, 0),
          ex('tempo-run',             6, 1, 0, 90),
        ],
      },
      {
        id: 'fb-cond-hiit',
        name: 'High Intensity Intervals (HIIT)',
        description: 'Short, maximal efforts 15–30s on, 15–30s off. Targets anaerobic capacity.',
        program: 'Football Conditioning',
        exercises: [
          ex('hiit-run',     10, 1, 0, 30),
          ex('shuttle-run',   3, 1, 0, 90),
        ],
      },
      {
        id: 'fb-cond-rsa',
        name: 'Repeated Sprint Ability (RSA)',
        description: '6–10 × 30–40m sprints, 30s recovery. Mimics match demands.',
        program: 'Football Conditioning',
        exercises: [
          ex('repeated-sprint', 8, 1, 0, 30),
          ex('shuttle-run',     4, 1, 0, 60),
        ],
      },
      {
        id: 'fb-cond-mixed',
        name: 'Match Simulation Conditioning',
        description: 'Mixed intensity session replicating a 90-minute match energy profile.',
        program: 'Football Conditioning',
        exercises: [
          ex('tempo-run',       3, 1, 0, 120),
          ex('hiit-run',        6, 1, 0, 30),
          ex('repeated-sprint', 6, 1, 0, 30),
          ex('ssg-simulation',  2, 1, 0, 180),
        ],
      },
      {
        id: 'fb-cond-inseason',
        name: 'In-Season Conditioning (Non-Match Days)',
        description: 'Maintain fitness without accumulating fatigue. MD-3 / MD-2 appropriate.',
        program: 'Football Conditioning',
        exercises: [
          ex('tempo-run',       3, 1, 0, 90),
          ex('shuttle-run',     4, 1, 0, 60),
          ex('repeated-sprint', 3, 1, 0, 60),
        ],
      },
    ],
  },
];

export const ALL_PROGRAMS = [...FOOTBALL_PROGRAMS, ...BUILT_IN_PROGRAMS];
