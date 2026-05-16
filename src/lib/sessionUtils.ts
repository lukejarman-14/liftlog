import { ProgrammeSession, WorkoutExercise, Exercise, GeneratedProgramme } from '../types';

// ── Programme week helpers ─────────────────────────────────────────────────

/** Returns the Monday (00:00) of the week containing `ts` */
function getStartMonday(ts: number): Date {
  const d = new Date(ts);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the zero-based index of the current week within the programme.
 * Clamped to [0, durationWeeks-1].
 */
export function getProgrammeWeekIndex(programme: GeneratedProgramme): number {
  const startMonday = getStartMonday(programme.createdAt);
  const nowMonday = getStartMonday(Date.now());
  const diff = Math.floor(
    (nowMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  return Math.max(0, Math.min(diff, programme.durationWeeks - 1));
}

// ── Name → exercise-library ID map (shared between GeneratedProgramme & WeeklyCalendar) ──

export const NAME_TO_ID: Record<string, string> = {
  'back squat': 'squat', 'front squat': 'front-squat',
  'romanian deadlift': 'rdl', 'rdl': 'rdl',
  'trap bar deadlift': 'deadlift', 'hex bar deadlift': 'deadlift', 'deadlift': 'deadlift',
  'bench press': 'bench-press', 'db bench press': 'db-bench',
  'pull-up': 'pull-up', 'weighted pull-up': 'pull-up',
  'push press': 'ohp', 'overhead press': 'ohp',
  'dumbbell shoulder press': 'db-ohp', 'db shoulder press': 'db-ohp',
  'dumbbell row': 'db-row', 'db row': 'db-row',
  'goblet squat': 'squat',
  'bulgarian split squat': 'bulgarian-split-squat-db',
  'bulgarian split squat (db)': 'bulgarian-split-squat-db',
  'bulgarian split squat (bw)': 'bulgarian-split-squat',
  'bulgarian split squat (barbell)': 'bulgarian-split-squat',
  'barbell bulgarian split squat': 'bulgarian-split-squat',
  'split squat': 'bulgarian-split-squat',
  'reverse lunge': 'lunge', 'lunge': 'lunge',
  'hip thrust': 'hip-thrust', 'glute bridge': 'hip-thrust',
  'calf raise': 'calf-raise', 'plank': 'plank',
  'kettlebell swing': 'kettlebell-swing',
  'jump squat': 'squat',
  'box jump': 'box-jump',
  'broad jump': 'broad-jump',
  'countermovement jump': 'test-cmj', 'cmj': 'test-cmj',
  'pogo hops': 'pogo-jump', 'pogo hop': 'pogo-jump', 'pogo jumps': 'pogo-jump',
  'nordic hamstring curl': 'eccentric-nordic', 'nordic curl': 'nordic-curl', 'leg curl': 'leg-curl',
  // Isometric holds — explicit to prevent fuzzy mis-matching to 'lunge' / 'calf-raise' etc.
  'isometric split squat hold': 'iso-lunge-hold',
  'single-leg calf isometric hold': 'calf-raise-hold', 'single-leg calf hold': 'calf-raise-hold',
  'single-leg isometric wall sit': 'iso-squat-hold',
  'copenhagen plank': 'copenhagen-plank',
  // Warm-up / mobility — explicit entries prevent fuzzy mis-matching
  'hip 90/90 mobilisation': 'hip-90-90', 'hip 90/90': 'hip-90-90',
  "world's greatest stretch": 'worlds-greatest-stretch',
  'glute bridge hold + march': 'glute-bridge-march', 'glute bridge march': 'glute-bridge-march',
  'ankle circles + eccentric calf raise': 'ankle-circles-calf',
  'air squat': 'air-squat',
  'prone t-y-i': 'prone-tyi',
  'lateral shuffle': 'lateral-shuffle',
  'a-skip': 'a-skip',
  'high knees': 'high-knees',
  // Running / speed / conditioning — explicit to prevent fuzzy collision with box-jump etc.
  'box-to-box sprint': 'repeated-sprint',
  'box-to-box sprint repeats': 'repeated-sprint',
  'repeated sprint ability': 'repeated-sprint',
  '30-15 intermittent intervals': 'hiit-run',
  'sprint + controlled decel + sprint': 'repeated-sprint',
  '30m acceleration sprint + hard stop': 'repeated-sprint',
  'turn & sprint': 'repeated-sprint',
  'short sprint + recovery jog circuit': 'hiit-run',
  'press trigger intervals': 'hiit-run',
  'high-press interval run': 'hiit-run',
  'acceleration from set position': 'repeated-sprint',
  'flying 30m sprint': 'repeated-sprint',
  'sprint + cut + sprint': 'repeated-sprint',
  'hip flexor sprint drill': 'repeated-sprint',
  'single-leg broad jump': 'broad-jump',
  '5-10-5 pro agility drill': 'pro-agility',
  't-drill': 'pro-agility',
  'reactive cone drill (partner)': 'pro-agility',
  'aerobic threshold run': 'aerobic-threshold-run',
  'cardiac output circuit': 'hiit-run',
};

function parseRest(rest: string): number {
  if (!rest) return 90;
  const m = rest.match(/(\d+):(\d+)/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const s = rest.match(/(\d+)\s*s/);
  if (s) return parseInt(s[1], 10);
  const min = rest.match(/(\d+)\s*min/);
  if (min) return parseInt(min[1], 10) * 60;
  const plain = rest.match(/^(\d+)$/);
  if (plain) return parseInt(plain[1], 10);
  return 90;
}

function parseReps(reps: string): number {
  const n = parseInt(reps, 10);
  return isNaN(n) ? 8 : Math.min(n, 60);
}

function parseSets(sets: string): number {
  const n = parseInt(sets, 10);
  return isNaN(n) ? 3 : Math.min(n, 6);
}

export function sessionToWorkoutExercises(
  session: ProgrammeSession,
  exercises: Exercise[],
): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  const used = new Set<string>();

  for (const block of session.blocks) {
    let isFirstInBlock = true;

    for (const pe of block.exercises) {
      const key = pe.name.toLowerCase().split('(')[0].trim();
      let id: string | undefined;

      id = NAME_TO_ID[key];

      if (!id) {
        for (const [pattern, mappedId] of Object.entries(NAME_TO_ID)) {
          if (key.includes(pattern) || pattern.includes(key.split(' ')[0])) {
            id = mappedId;
            break;
          }
        }
      }

      if (!id) {
        const found = exercises.find(e =>
          e.name.toLowerCase().includes(key.split(' ')[0]) ||
          key.includes(e.name.toLowerCase().split(' ')[0]),
        );
        id = found?.id;
      }

      const exercise = id ? exercises.find(e => e.id === id) : undefined;
      if (id && !used.has(id) && exercise) {
        used.add(id);
        const isCond = exercise.category === 'Conditioning';
        // Conditioning: pe.sets = number of intervals, each interval = 1 rep.
        // Bypass the 6-set cap and skip the time-based reps field.
        const targetSets = isCond
          ? Math.min(Math.max(parseInt(pe.sets, 10) || 1, 1), 25)
          : parseSets(pe.sets);
        const targetReps = isCond ? 1 : parseReps(pe.reps);
        const restSeconds = isCond ? 30 : parseRest(pe.rest);
        result.push({
          exerciseId: id,
          targetSets,
          targetReps,
          targetWeight: 0,
          restSeconds,
          blockTitle: isFirstInBlock ? block.title : undefined,
        });
        isFirstInBlock = false;
      }
    }
  }

  return result.slice(0, 25);
}
