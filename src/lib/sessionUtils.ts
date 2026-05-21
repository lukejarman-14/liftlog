import { ProgrammeSession, WorkoutExercise, Exercise, GeneratedProgramme } from '../types';

// ── Programme week helpers ─────────────────────────────────────────────────

/** Monday of the week containing ts (rolls back). */
function getCurrentWeekMonday(ts: number): Date {
  const d = new Date(ts);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Monday ON OR AFTER ts.
 * Sunday → next Monday. Monday → same day. Tue-Sat → following Monday.
 * Ensures Week 1 sessions always fall in the future when user picks a start date.
 */
function getAnchorMonday(ts: number): Date {
  const d = new Date(ts);
  const dow = d.getDay();
  d.setHours(0, 0, 0, 0);
  if (dow === 1) return d;
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
  return d;
}

/**
 * Returns the zero-based index of the current week within the programme.
 * Clamped to [0, durationWeeks-1].
 */
export function getProgrammeWeekIndex(programme: GeneratedProgramme): number {
  const anchor = programme.programmeStartDate
    ? new Date(programme.programmeStartDate + 'T12:00:00').getTime()
    : programme.createdAt;
  const startMonday = programme.programmeStartDate
    ? getAnchorMonday(anchor)
    : getCurrentWeekMonday(anchor);
  const nowMonday = getCurrentWeekMonday(Date.now());
  const diff = Math.floor(
    (nowMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  return Math.max(0, Math.min(diff, programme.durationWeeks - 1));
}

/**
 * Returns the Monday ON OR AFTER the programme start date.
 * Exported so WeeklyCalendar can compute absolute session dates.
 */
export function getProgrammeAnchorMonday(programme: GeneratedProgramme): Date {
  const anchor = programme.programmeStartDate
    ? new Date(programme.programmeStartDate + 'T12:00:00').getTime()
    : programme.createdAt;
  // Always roll back to the Monday of the chosen week so sessions within that week
  // are scheduled correctly. Rolling forward would push mid-week start dates to the
  // following Monday, delaying Week 1 by up to 6 days.
  return getCurrentWeekMonday(anchor);
}

// ── Name → exercise-library ID map (shared between GeneratedProgramme & WeeklyCalendar) ──

export const NAME_TO_ID: Record<string, string> = {
  'back squat': 'squat', 'front squat': 'front-squat',
  // RDL variants — full names first so they aren't grabbed by 'deadlift' fuzzy match
  'barbell romanian deadlift (eccentric emphasis)': 'eccentric-rdl',
  'barbell romanian deadlift (concentric focus)': 'rdl',
  'barbell romanian deadlift': 'rdl',
  'single-leg romanian deadlift': 'rdl',
  'db single-leg romanian deadlift': 'rdl',
  'eccentric single-leg rdl': 'eccentric-sl-rdl',
  'romanian deadlift': 'rdl', 'rdl': 'rdl',
  // Deadlift variants
  'trap bar deadlift': 'deadlift', 'hex bar deadlift': 'deadlift', 'deadlift': 'deadlift',
  // Dead Bug — explicit to prevent fuzzy match on 'dead-hang' / 'deadlift'
  'dead bug': 'dead-bug',
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
  'jump squat': 'squat-jump',
  'box jump': 'box-jump',
  'broad jump': 'broad-jump',
  'countermovement jump': 'cmj', 'cmj': 'test-cmj',
  'depth jump': 'depth-jump',
  'pogo hop': 'pogo-jump', 'pogo jumps': 'pogo-jump',
  'nordic hamstring curl': 'eccentric-nordic', 'nordic curl': 'nordic-curl', 'leg curl': 'leg-curl',
  'eccentric slider curl': 'eccentric-slider-curl',
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
  // Reactive plyometrics — explicit entries prevent fuzzy matcher hitting 'Lat Pulldown' for 'lateral ankle hops'
  'pogo hops': 'pogo-jump',
  'single-leg pogo hops': 'pogo-jump',
  'lateral ankle hops': 'ankle-hop',
  'skipping (fast cadence)': 'repeated-sprint',
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
  'aerobic base run': 'aerobic-threshold-run',
  'cardiac output circuit': 'hiit-run',
  // Aerobic running variants — all single-effort continuous runs
  'cardiac output run': 'aerobic-threshold-run',
  'extended cardiac output run': 'aerobic-threshold-run',
  'progressive aerobic run': 'aerobic-threshold-run',
  'sustained threshold run': 'aerobic-threshold-run',
  'aerobic fartlek': 'aerobic-threshold-run',
  'aerobic maintenance run': 'aerobic-threshold-run',
  'aerobic threshold maintenance': 'aerobic-threshold-run',
  'mixed aerobic circuit': 'aerobic-threshold-run',
  'easy aerobic run': 'aerobic-threshold-run',
  'light aerobic run': 'aerobic-threshold-run',
  'activation jog': 'aerobic-threshold-run',
  // Multi-set aerobic interval variants (isTimedAerobic won't fire for sets > 1)
  'extensive aerobic intervals': 'aerobic-threshold-run',
  'threshold intervals': 'aerobic-threshold-run',
  'reduced threshold intervals': 'aerobic-threshold-run',
  'aerobic maintenance intervals': 'aerobic-threshold-run',
  // HIIT interval variants
  '15/15 hiit — introduction': 'hiit-run',
  '15/15 hiit — full volume': 'hiit-run',
  '15/15 hiit — strength phase': 'hiit-run',
  '15/15 hiit — express': 'hiit-run',
  'short hiit intervals — foundation': 'hiit-run',
  'norwegian 4×4 hiit': 'hiit-run',
  '30/30 protocol — foundation': 'hiit-run',
  '40/20 hiit protocol': 'hiit-run',
  '3×4 hiit — reduced volume': 'hiit-run',
  'match simulation intervals': 'hiit-run',
  '2×4 hiit — peak taper': 'hiit-run',
  'short sprint activation': 'repeated-sprint',
};

/**
 * For distance-based RSA exercises like "6 × 30m · 25s rest" with pe.sets = "3",
 * the programme means 3 groups × 6 sprints each. Returns the reps-per-set multiplier.
 * Returns 1 when the reps string is timed (not distance) or has no leading "N ×" pattern,
 * or when N equals the sets count (meaning sets already = individual reps).
 */
function parseDistanceRepsPerSet(setsStr: string, repsStr: string): number {
  const m = repsStr.match(/^(\d+)\s*×/);
  if (!m) return 1;
  const repsPerSet = parseInt(m[1], 10);
  const sets = parseInt(setsStr, 10) || 1;
  // Only multiply when the rep count differs from sets count, to avoid double-counting
  // exercises where sets already represents individual reps (e.g. "6 sets × 6 × 30m" descriptive).
  return repsPerSet !== sets ? repsPerSet : 1;
}

/** Parse a raw time string like "30s", "4 min", "3:00", "90s" → seconds (0 if unrecognised). */
function parseTimeSecs(s: string): number {
  if (!s) return 0;
  const mm = s.match(/(\d+):(\d+)/);
  if (mm) return parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10);
  const sec = s.match(/(\d+)\s*s\b/i);
  if (sec) return parseInt(sec[1], 10);
  const min = s.match(/(\d+)\s*min/i);
  if (min) return parseInt(min[1], 10) * 60;
  return 0;
}

/**
 * For interval conditioning exercises, extract the per-rep work duration in seconds.
 * e.g. "30s hard · 30s rest" → 30, "4 min @ 90% HRmax · 3 min jog" → 240,
 *      "15s sprint · 15s jog" → 15, "8 × 30m · 2 min rest" → 0 (distance-based, no timer)
 */
function parseCondWorkSecs(repsStr: string): number {
  if (!repsStr) return 0;
  // Pattern: starts with a time value: "30s …", "4 min …", "40s @…"
  const leadSec = repsStr.match(/^(\d+)\s*s\b/i);
  if (leadSec) return parseInt(leadSec[1], 10);
  const leadMin = repsStr.match(/^(\d+)\s*min/i);
  if (leadMin) return parseInt(leadMin[1], 10) * 60;
  // Pattern: "N × <time>" e.g. "6 × 4 min on · 2 min walk"
  const afterX = repsStr.match(/×\s*(\d+)\s*min/i);
  if (afterX) return parseInt(afterX[1], 10) * 60;
  const afterXs = repsStr.match(/×\s*(\d+)\s*s\b/i);
  if (afterXs) return parseInt(afterXs[1], 10);
  return 0; // distance-based (e.g. "8 × 30m") — no work timer
}

/**
 * Extract the rest duration from a conditioning reps string.
 * Looks at the segment after '·'; falls back to restStr (pe.rest).
 * e.g. "30s hard · 30s rest" → 30, "4 min @ 90% · 3 min jog" → 180
 */
function parseCondRestSecs(repsStr: string, restStr: string): number {
  const parts = repsStr.split('·');
  if (parts.length > 1) {
    const s = parseTimeSecs(parts[parts.length - 1].trim());
    if (s > 0) return s;
  }
  // Fall back to pe.rest
  return parseRest(restStr);
}

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
      const fullKey = pe.name.toLowerCase();
      const key = fullKey.split('(')[0].trim();
      let id: string | undefined;

      // Full-name lookup first (catches variants like "Barbell Romanian Deadlift (Eccentric Emphasis)")
      id = NAME_TO_ID[fullKey] ?? NAME_TO_ID[key];

      if (!id) {
        for (const [pattern, mappedId] of Object.entries(NAME_TO_ID)) {
          if (key.includes(pattern)) {
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
        // Time-based aerobic (measureType: 'time'): show as 1 set × duration-in-seconds timer.
        // Only applies to single-set continuous runs (sets ≤ 1). Multi-set intervals (sets > 1)
        // go through the normal condWorkSecs path so all intervals show as countdown timers.
        const isTimedAerobic = isCond && exercise.measureType === 'time' && parseInt(pe.sets, 10) <= 1;
        // For interval conditioning: parse actual work duration from pe.reps.
        // e.g. "30s hard · 30s rest" → 30s work. Distance-based ("8 × 30m") → 0 (no timer).
        const condWorkSecs = isCond && !isTimedAerobic ? parseCondWorkSecs(pe.reps) : 0;
        // For distance-based RSA exercises ("3 sets × 6 × 30m"), multiply sets × reps-per-set
        // so the guided sprint flow shows all individual sprints (e.g. 3×6 = 18 total).
        const distanceRepsPerSet = isCond && !isTimedAerobic && condWorkSecs === 0
          ? parseDistanceRepsPerSet(pe.sets, pe.reps)
          : 1;
        const targetSets = isTimedAerobic ? 1
          : isCond ? Math.min(Math.max(parseInt(pe.sets, 10) || 1, 1) * distanceRepsPerSet, 25)
          : parseSets(pe.sets);
        const targetReps = isTimedAerobic
          ? (() => { const m = pe.reps.match(/(\d+)\s*min/); return m ? parseInt(m[1], 10) * 60 : 1800; })()
          : isCond ? (condWorkSecs > 0 ? condWorkSecs : 1)
          : parseReps(pe.reps);
        // For interval conditioning: parse rest from the reps string (e.g. "· 30s rest")
        // rather than using the hardcoded 30s fallback.
        const restSeconds = isTimedAerobic ? 0
          : isCond ? parseCondRestSecs(pe.reps, pe.rest)
          : parseRest(pe.rest);
        result.push({
          exerciseId: id,
          targetSets,
          targetReps,
          targetWeight: 0,
          restSeconds,
          blockTitle: isFirstInBlock ? block.title : undefined,
          displayName: pe.name !== exercise.name ? pe.name : undefined,
          coachingCue: pe.cue || undefined,
        });
        isFirstInBlock = false;
      }
    }
  }

  return result.slice(0, 25);
}
