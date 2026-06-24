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
  blockTitle?: string,
): WorkoutExercise {
  return blockTitle
    ? { exerciseId, targetSets, targetReps, targetWeight, restSeconds, blockTitle }
    : { exerciseId, targetSets, targetReps, targetWeight, restSeconds };
}

// HIIT shuttle: one exercise, N sets, each set its own rep count (perSetReps).
// targetReps stays 1 so ActiveWorkout treats every rep as a sprint (not a seconds
// countdown); the guided interval timer reads perSetReps. 60s rest between sets only.
function shuttleEx(perSetReps: number[]): WorkoutExercise {
  return {
    exerciseId: 'shuttle-18yard',
    targetSets: perSetReps.length,
    targetReps: 1,
    targetWeight: 0,
    restSeconds: 60,
    perSetReps,
  };
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
          ex('plank',       3, 30, 0,  60),
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


export const FOOTBALL_PROGRAMS: Program[] = [
  {
    name: 'Footballer Weekly Sessions',
    description: '3 football S&C workouts per week. Each session opens with speed and power work (jumps, sprints), then moves into pure strength. No conditioning included.',
    sport: 'football',
    templates: [
      {
        id: 'fb-weekly-session1',
        name: 'Upper Body',
        description: 'Neural primer with jumps, then upper body push, pull and shoulder strength.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          ex('cmj',         4, 5,  0,  120, '⚡ Power Primer'),
          ex('broad-jump',  3, 4,  0,  90),
          ex('bench-press', 4, 6,  65, 180, '💪 Push'),
          ex('barbell-row', 4, 6,  55, 180, '💪 Pull'),
          ex('ohp',         3, 8,  40, 150, '🦵 Accessory'),
          ex('pull-up',     3, 8,  0,  120),
          ex('face-pull',   3, 15, 20, 60,  '🛡️ Shoulder'),
        ],
      },
      {
        id: 'fb-weekly-session2',
        name: 'Lower Body',
        description: 'Acceleration sprints and jumps to prime the nervous system, then lower body strength.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          ex('sprint',      4, 1,  0,  180, '⚡ Speed Primer'),
          ex('box-jump',    4, 5,  0,  120),
          ex('broad-jump',  3, 5,  0,  90),
          ex('squat',       4, 5,  80, 240, '💪 Main Strength'),
          ex('rdl',         3, 8,  65, 180),
          ex('hip-thrust',  3, 8,  75, 120, '🦵 Support Work'),
          ex('nordic-curl', 3, 6,  0,  120),
        ],
      },
      {
        id: 'fb-weekly-session3',
        name: 'Full Body',
        description: 'Jumps and sprint primer, then a balanced full-body strength session.',
        program: 'Footballer Weekly Sessions',
        exercises: [
          ex('cmj',         4, 5,  0,  120, '⚡ Power Primer'),
          ex('sprint',      3, 1,  0,  180),
          ex('squat',       3, 5,  80, 240, '💪 Lower'),
          ex('deadlift',    3, 5,  95, 240),
          ex('bench-press', 3, 6,  65, 180, '💪 Upper'),
          ex('barbell-row', 3, 8,  55, 150),
          ex('ohp',         3, 8,  40, 150, '🦵 Accessory'),
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
    description: 'Standalone conditioning sessions — Zone 2, Repeated Sprint Ability, and two HIIT workouts, each with difficulty levels. Pick a session and run it on its own.',
    sport: 'football',
    templates: [
      {
        id: 'fb-cond-zone2',
        name: 'Zone 2 — Steady State',
        description: '20 min continuous run at 65–70% max HR. Aerobic base, zero CNS cost — slots in around heavy gym days.',
        program: 'Football Conditioning',
        exercises: [
          ex('zone2-run', 1, 1, 0, 0),
        ],
      },

      // ── RSA — 30m repeated sprints, 30s rest. Difficulty = number of sprints. ──
      {
        id: 'fb-cond-rsa-easy',
        name: 'RSA — Easy (6 × 30m)',
        description: '6 × 30m flat-out sprints, 30s recovery. Entry-level repeated sprint ability.',
        program: 'Football Conditioning',
        exercises: [
          ex('repeated-sprint', 6, 1, 0, 30),
        ],
      },
      {
        id: 'fb-cond-rsa-medium',
        name: 'RSA — Medium (8 × 30m)',
        description: '8 × 30m flat-out sprints, 30s recovery. Standard match-replication volume.',
        program: 'Football Conditioning',
        exercises: [
          ex('repeated-sprint', 8, 1, 0, 30),
        ],
      },
      {
        id: 'fb-cond-rsa-hard',
        name: 'RSA — Hard (10 × 30m)',
        description: '10 × 30m flat-out sprints, 30s recovery. High repeated-sprint demand.',
        program: 'Football Conditioning',
        exercises: [
          ex('repeated-sprint', 10, 1, 0, 30),
        ],
      },
      {
        id: 'fb-cond-rsa-extra',
        name: 'RSA — Extra Hard (12 × 30m)',
        description: '12 × 30m flat-out sprints, 30s recovery. Maximal repeated-sprint capacity.',
        program: 'Football Conditioning',
        exercises: [
          ex('repeated-sprint', 12, 1, 0, 30),
        ],
      },

      // ── HIIT Shuttle — 18-yard shuttle, 3 sets, 60s rest between sets only.
      // Difficulty = per-set rep structure. perSetReps drives the guided interval timer
      // (one sprint per rep); targetReps stays 1 so the conditioning heuristic treats
      // each rep as a sprint rather than a seconds-countdown. ──
      {
        id: 'fb-cond-shuttle-easy',
        name: 'HIIT Shuttle — Easy',
        description: '18-yard shuttle accelerations. Set 1: 1 rep, set 2: 2 reps, set 3: 4 reps. No rest between reps; 60s rest between sets only.',
        program: 'Football Conditioning',
        exercises: [
          shuttleEx([1, 2, 4]),
        ],
      },
      {
        id: 'fb-cond-shuttle-medium',
        name: 'HIIT Shuttle — Medium',
        description: '18-yard shuttle accelerations. Set 1: 2 reps, set 2: 3 reps, set 3: 4 reps. No rest between reps; 60s rest between sets only.',
        program: 'Football Conditioning',
        exercises: [
          shuttleEx([2, 3, 4]),
        ],
      },
      {
        id: 'fb-cond-shuttle-hard',
        name: 'HIIT Shuttle — Hard',
        description: '18-yard shuttle accelerations. Set 1: 3 reps, set 2: 3 reps, set 3: 4 reps. No rest between reps; 60s rest between sets only.',
        program: 'Football Conditioning',
        exercises: [
          shuttleEx([3, 3, 4]),
        ],
      },
      {
        id: 'fb-cond-shuttle-extra',
        name: 'HIIT Shuttle — Extra Hard',
        description: '18-yard shuttle accelerations. Set 1: 3 reps, set 2: 4 reps, set 3: 4 reps. No rest between reps; 60s rest between sets only.',
        program: 'Football Conditioning',
        exercises: [
          shuttleEx([3, 4, 4]),
        ],
      },

      // ── HIIT Max Effort — 4-min max-effort runs, 2 min rest. Difficulty = number of efforts. ──
      {
        id: 'fb-cond-maxeffort-easy',
        name: 'HIIT Max Effort — Easy (2 × 4 min)',
        description: '2 efforts of 4 minutes at max sustainable pace, 2 min rest. Entry-level VO₂max work.',
        program: 'Football Conditioning',
        exercises: [
          ex('max-effort-run', 2, 1, 0, 120),
        ],
      },
      {
        id: 'fb-cond-maxeffort-medium',
        name: 'HIIT Max Effort — Medium (4 × 4 min)',
        description: '4 efforts of 4 minutes at max sustainable pace, 2 min rest. Standard VO₂max session.',
        program: 'Football Conditioning',
        exercises: [
          ex('max-effort-run', 4, 1, 0, 120),
        ],
      },
      {
        id: 'fb-cond-maxeffort-hard',
        name: 'HIIT Max Effort — Hard (6 × 4 min)',
        description: '6 efforts of 4 minutes at max sustainable pace, 2 min rest. High aerobic-power demand.',
        program: 'Football Conditioning',
        exercises: [
          ex('max-effort-run', 6, 1, 0, 120),
        ],
      },
      {
        id: 'fb-cond-maxeffort-extra',
        name: 'HIIT Max Effort — Extra Hard (8 × 4 min)',
        description: '8 efforts of 4 minutes at max sustainable pace, 2 min rest. Maximal aerobic-power capacity.',
        program: 'Football Conditioning',
        exercises: [
          ex('max-effort-run', 8, 1, 0, 120),
        ],
      },
    ],
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// Conditioning picker — groups the standalone Football Conditioning templates into
// four selectable workout types, each exposing its difficulty levels as a dropdown.
// Source of truth is the 'Football Conditioning' program above, so there is no
// duplicated exercise data.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConditioningLevel {
  label: string;
  template: BuiltInTemplate;
}

export interface ConditioningOption {
  key: string;
  name: string;
  description: string;
  levels: ConditioningLevel[];
}

const COND_PROGRAM = FOOTBALL_PROGRAMS.find(p => p.name === 'Football Conditioning');

function condTemplate(id: string): BuiltInTemplate {
  const t = COND_PROGRAM?.templates.find(tpl => tpl.id === id);
  if (!t) throw new Error(`Conditioning template not found: ${id}`);
  return t;
}

export const FOOTBALL_CONDITIONING_OPTIONS: ConditioningOption[] = [
  {
    key: 'zone2',
    name: 'Zone 2 — Steady State',
    description: '20 min continuous run at 65–70% max HR. Aerobic base, zero CNS cost.',
    levels: [
      { label: 'Standard', template: condTemplate('fb-cond-zone2') },
    ],
  },
  {
    key: 'rsa',
    name: 'RSA — Repeated Sprints',
    description: '30m flat-out sprints, 30s recovery. Difficulty sets the number of sprints.',
    levels: [
      { label: 'Easy · 6',        template: condTemplate('fb-cond-rsa-easy') },
      { label: 'Medium · 8',      template: condTemplate('fb-cond-rsa-medium') },
      { label: 'Hard · 10',       template: condTemplate('fb-cond-rsa-hard') },
      { label: 'Extra Hard · 12', template: condTemplate('fb-cond-rsa-extra') },
    ],
  },
  {
    key: 'shuttle',
    name: 'HIIT Shuttle — 18-Yard',
    description: '18-yard shuttle accelerations, three sets, 60s rest between sets only. Difficulty sets the rep structure.',
    levels: [
      { label: 'Easy · 1·2·4',       template: condTemplate('fb-cond-shuttle-easy') },
      { label: 'Medium · 2·3·4',     template: condTemplate('fb-cond-shuttle-medium') },
      { label: 'Hard · 3·3·4',       template: condTemplate('fb-cond-shuttle-hard') },
      { label: 'Extra Hard · 3·4·4', template: condTemplate('fb-cond-shuttle-extra') },
    ],
  },
  {
    key: 'maxeffort',
    name: 'HIIT Max Effort — 4 min',
    description: '4-minute max-effort runs, 2 min rest. Difficulty sets the number of efforts.',
    levels: [
      { label: 'Easy · 2',       template: condTemplate('fb-cond-maxeffort-easy') },
      { label: 'Medium · 4',     template: condTemplate('fb-cond-maxeffort-medium') },
      { label: 'Hard · 6',       template: condTemplate('fb-cond-maxeffort-hard') },
      { label: 'Extra Hard · 8', template: condTemplate('fb-cond-maxeffort-extra') },
    ],
  },
];
