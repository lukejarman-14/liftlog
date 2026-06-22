import { ProgrammeSession, WorkoutExercise, Exercise, GeneratedProgramme, StrengthSetup } from '../types';
import { getLiftKey, prescribeWeekLoad, roundPlate } from './progressiveOverload';


export type ResolutionVia = 'exact' | 'partial' | 'fuzzy' | 'none';

export interface ResolutionResult {
  id: string | undefined;
  via: ResolutionVia;
  /** Only set when via === 'fuzzy' — the exercise it guessed */
  fuzzyMatch?: { id: string; name: string };
}

/**
 * Resolve a programme exercise name to a library exercise ID.
 * Returns how it was resolved so callers can distinguish safe (exact/partial)
 * from fragile (fuzzy) and missing (none) resolutions.
 * This is the single source of truth — sessionToWorkoutExercises and
 * validateProgrammeSession both call this so they can never diverge.
 */
export function resolveExerciseId(name: string, exercises: Exercise[]): ResolutionResult {
  const fullKey = name.toLowerCase();
  const key = fullKey.split('(')[0].trim();

  // Exact match against the canonical name map
  const exactId = NAME_TO_ID[fullKey] ?? NAME_TO_ID[key];
  if (exactId) return { id: exactId, via: 'exact' };

  // Partial match — key contains a known pattern
  for (const [pattern, mappedId] of Object.entries(NAME_TO_ID)) {
    if (key.includes(pattern)) return { id: mappedId, via: 'partial' };
  }

  // Fuzzy — first-word match against exercise library (fragile)
  const firstWord = key.split(' ')[0];
  const found = exercises.find(e =>
    e.name.toLowerCase().includes(firstWord) ||
    key.includes(e.name.toLowerCase().split(' ')[0]),
  );
  if (found) return { id: found.id, via: 'fuzzy', fuzzyMatch: { id: found.id, name: found.name } };

  return { id: undefined, via: 'none' };
}


export interface SessionValidation {
  /** Exercises the generator produced that will be silently dropped */
  dropped: string[];
  /** Exercises resolved only by the fragile first-word fuzzy fallback */
  fuzzyMatched: Array<{ programmeName: string; resolvedId: string; resolvedName: string }>;
}

/**
 * Validate a ProgrammeSession against the exercise library without side-effects.
 * Returns which exercises would be dropped or fuzzy-matched if the session were started now.
 * Useful in dev-mode overlays and pre-flight checks.
 */
export function validateProgrammeSession(
  session: ProgrammeSession,
  exercises: Exercise[],
): SessionValidation {
  const dropped: string[] = [];
  const fuzzyMatched: SessionValidation['fuzzyMatched'] = [];
  const seen = new Set<string>();

  for (const block of session.blocks) {
    for (const pe of block.exercises) {
      const { id, via, fuzzyMatch } = resolveExerciseId(pe.name, exercises);
      if (!id || !exercises.find(e => e.id === id)) {
        dropped.push(pe.name);
      } else if (via === 'fuzzy' && fuzzyMatch && !seen.has(id)) {
        fuzzyMatched.push({ programmeName: pe.name, resolvedId: fuzzyMatch.id, resolvedName: fuzzyMatch.name });
      }
      if (id) seen.add(id);
    }
  }

  return { dropped, fuzzyMatched };
}


/** Monday of the week containing ts (rolls back). */
function getCurrentWeekMonday(ts: number): Date {
  const d = new Date(ts);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Monday of the week containing ts (rolls back).
 * Anchors week 1 to the Monday of the chosen week so sessions in the same
 * week as the start date are visible. Sessions before programmeStartDate are
 * filtered in WeeklyCalendar and LoadCalendar so no past sessions are shown.
 */
function getAnchorMonday(ts: number): Date {
  return getCurrentWeekMonday(ts);
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
  // When programmeStartDate is set, use getAnchorMonday (rolls forward to next Monday)
  // to match getProgrammeWeekIndex — both must use the same anchor or sessions land in
  // the wrong week. Without programmeStartDate, fall back to rolling back to the current
  // week's Monday (legacy behaviour for older programmes).
  return programme.programmeStartDate
    ? getAnchorMonday(anchor)
    : getCurrentWeekMonday(anchor);
}


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
  // Ab Wheel Rollout — explicit to prevent fuzzy match
  'ab wheel rollout': 'ab-wheel',
  'pallof press': 'pallof-press',
  'bench press': 'bench-press', 'db bench press': 'db-bench',
  'pull-up': 'pull-up', 'weighted pull-up': 'pull-up',
  'push press': 'ohp', 'overhead press': 'ohp',
  'dumbbell shoulder press': 'db-ohp', 'db shoulder press': 'db-ohp',
  'dumbbell row': 'db-row', 'db row': 'db-row',
  'goblet squat': 'squat', // intentionally mapped to Back Squat — no separate library entry; both track lower-body strength
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
  // 'cmj' as a programme exercise name → plyometrics library entry (id: 'cmj')
  // 'cmj' as a Testing Battery exercise is accessed directly by exerciseId, not via this map
  'countermovement jump': 'cmj',
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
  'lateral shuffle (warmup)': 'lateral-shuffle-warmup',
  'a-skip': 'a-skip',
  'high knees': 'high-knees',
  // Reactive plyometrics — explicit entries prevent fuzzy matcher hitting 'Lat Pulldown' for 'lateral ankle hops'
  'hurdle jump': 'hurdle-hop', 'hurdle hop': 'hurdle-hop',
  'pogo hops': 'pogo-jump',
  'single-leg pogo hops': 'pogo-jump',
  'lateral ankle hops': 'ankle-hop',
  'skipping (fast cadence)': 'pogo-jump',
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
  // Rebuilt conditioning (week-based progressive overload)
  'zone 2 steady-state run': 'aerobic-threshold-run',
  '18-yard shuttle acceleration': 'repeated-sprint',
  '4-minute max effort run': 'hiit-run',
  'repeated sprints — 30m': 'repeated-sprint',
  // Sled variants
  'sled push': 'sled-push',
  'sled push (heavy)': 'sled-push',
  'sled push — speed variant': 'sled-push',
  // Bounding / jumps
  'standing bounding': 'bounding',
  'squat jump': 'squat-jump',
  'lateral bound': 'lateral-bound',
  // Position-specific block exercises
  'lateral bound + stick': 'lateral-bound',
  'explosive lateral bound + stick': 'lateral-bound',
  'explosive step-up': 'squat-jump',
  'deficit reverse lunge (explosive drive)': 'lunge',
  'single-leg hip thrust (box)': 'hip-thrust',
  'loaded lunge (explosive drive)': 'lunge',
  // Bodyweight push-up variants
  'archer push-up': 'push-up',
  'explosive push-up': 'push-up',
  'plyometric push-up': 'push-up',
  'push-up (max effort)': 'push-up',
  // Inverted row variants
  'inverted row (feet elevated)': 'inverted-row',
  'inverted row (table or low bar)': 'inverted-row',
  // Isometric hip flexor
  'isometric hip flexor hold (kneeling)': 'iso-lunge-hold',
  // Recovery session exercises
  'low-intensity cycling or easy walk': 'aerobic-threshold-run',
  'prone hamstring isometric hold': 'iso-lunge-hold',
  'supine knee hug': 'hip-90-90',
  // Priming session warm-up exercises
  'progressive warm-up run': 'aerobic-threshold-run',
  'build-up sprint 50→70→85%': 'repeated-sprint',
  // Priming session position-specific exercises
  'lateral pogo jumps': 'pogo-jump',
  'low-amplitude drop jump': 'depth-jump',
  'medicine ball broad toss': 'broad-jump',
  'trap bar jump': 'squat-jump',
  'block start acceleration': 'repeated-sprint',
  // RSA conditioning warm-up
  'progressive sprint warm-up': 'repeated-sprint',
  // RSA session variants
  'rsa block training': 'repeated-sprint',
  'rsa maintenance sprints': 'repeated-sprint',
  'rsa activation sprints': 'repeated-sprint',
  'rsa sprint sets': 'repeated-sprint',
  'sprint rsa introduction': 'repeated-sprint',
  // Recovery / cool-down
  'cool-down jog': 'aerobic-threshold-run',
  // Core stability
  'bird dog': 'bird-dog',
  // Strength weakness exercises
  'paused squat (2s bottom hold)': 'squat',
  // Barbell row — explicit entry to prevent fuzzy mis-match to 'barbell back squat' etc.
  'barbell row': 'barbell-row',
  'barbell rows': 'barbell-row',
};


/**
 * Returns the two priming single weights for a given working weight:
 * [85%, 97%] each rounded to the nearest 2.5 kg.
 * Rest: 15 s after single 1, then 60 s after single 2 before working sets.
 */
export function calcPrimingWeights(workingWeightKg: number): [number, number] {
  return [
    roundPlate(workingWeightKg * 0.85),
    roundPlate(workingWeightKg * 0.97),
  ];
}

/** Categories where neural priming singles are appropriate (barbell/dumbbell strength work). */
const PRIMING_ELIGIBLE_CATEGORIES = new Set([
  'Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Full Body',
]);

/**
 * Returns true when an exercise should receive 2 ascending priming singles
 * before its working sets: must be a strength-measure exercise in a
 * compound-lift category, not a warm-up exercise.
 */
export function isPrimingEligible(exercise: Exercise): boolean {
  return (
    !exercise.isWarmup &&
    (exercise.measureType === 'strength' || exercise.measureType === undefined) &&
    PRIMING_ELIGIBLE_CATEGORIES.has(exercise.category)
  );
}

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
  if (import.meta.env.DEV && rest !== '—') {
    console.warn(`[sessionUtils] parseRest: unrecognised format "${rest}" — defaulting to 90s`);
  }
  return 90;
}

const MAX_REPS_CAP = 60;
const MAX_SETS_CAP = 6;

function parseReps(reps: string): number {
  const n = parseInt(reps, 10);
  return isNaN(n) ? 8 : Math.min(n, MAX_REPS_CAP);
}

function parseSets(sets: string): number {
  const n = parseInt(sets, 10);
  return isNaN(n) ? 3 : Math.min(n, MAX_SETS_CAP);
}

export function sessionToWorkoutExercises(
  session: ProgrammeSession,
  exercises: Exercise[],
  opts?: { strengthSetup?: StrengthSetup; weekNumber?: number; totalWeeks?: number },
): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  // Deduplicate by programme exercise name (not library ID) so exercises like
  // "Single-Leg Pogo Hops" and "Pogo Hops" — which both resolve to the same
  // library entry — can legitimately appear twice in the same session.
  const used = new Set<string>();

  for (const block of session.blocks) {
    let isFirstInBlock = true;

    for (const pe of block.exercises) {
      const fullKey = pe.name.toLowerCase();
      const key = fullKey.split('(')[0].trim();

      // Fast path: generator already resolved the ID at generation time.
      // This is the guaranteed-correct path for all programmes generated after
      // exerciseId was introduced — no lookup chain, no fuzzy fallback, no drops.
      let id: string | undefined = pe.exerciseId;

      // Slow path: fall back to runtime resolution for old saved programmes
      // that pre-date the exerciseId field.
      let via: ResolutionVia = 'exact';
      let fuzzyMatch: { id: string; name: string } | undefined;
      if (!id) {
        const resolved = resolveExerciseId(pe.name, exercises);
        id = resolved.id;
        via = resolved.via;
        fuzzyMatch = resolved.fuzzyMatch;

        // Dev-mode warnings only fire on the slow path (old programmes).
        // New programmes with exerciseId set never reach here.
        if (import.meta.env.DEV) {
          if (via === 'fuzzy' && fuzzyMatch) {
            console.warn(
              `[sessionUtils] ⚠️ FUZZY MATCH used for "${pe.name}" → "${fuzzyMatch.id}" ("${fuzzyMatch.name}"). ` +
              `This is fragile — add an explicit entry to NAME_TO_ID in sessionUtils.ts:\n` +
              `  '${fullKey}': '${fuzzyMatch.id}',`,
            );
          } else if (via === 'none') {
            console.warn(
              `[sessionUtils] ❌ EXERCISE DROPPED — no match for "${pe.name}" (key: "${key}"). ` +
              `Add an explicit entry to NAME_TO_ID in sessionUtils.ts:\n` +
              `  '${fullKey}': '<exercise-id>',`,
            );
          } else if (id && !exercises.find(e => e.id === id)) {
            console.warn(
              `[sessionUtils] ❌ EXERCISE DROPPED — NAME_TO_ID maps "${pe.name}" → "${id}" ` +
              `but no exercise with that ID exists in the library. Check exercises.ts.`,
            );
          }
        }
      }

      const exercise = id ? exercises.find(e => e.id === id) : undefined;
      if (id && !used.has(fullKey) && exercise) {
        used.add(fullKey);
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
          ? (() => { const m = pe.reps?.match(/(\d+)\s*mins?/); return m ? parseInt(m[1], 10) * 60 : 1800; })()
          : isCond ? (condWorkSecs > 0 ? condWorkSecs : 1)
          : parseReps(pe.reps);
        // For interval conditioning: parse rest from the reps string (e.g. "· 30s rest")
        // rather than using the hardcoded 30s fallback.
        const restSeconds = isTimedAerobic ? 0
          : isCond ? parseCondRestSecs(pe.reps, pe.rest)
          : parseRest(pe.rest);
        // Populate targetWeight from strength setup when available.
        // For strength exercises with a matching lift key, prescribe the
        // week-specific load (e.g. week 3 of 12 at 82% 1RM + micro-progression).
        // Falls back to the player's raw working weight if the intensity isn't
        // a parseable %1RM string (e.g. "3 RIR" or bodyweight exercises).
        let targetWeight = 0;
        if (!isCond && opts?.strengthSetup && opts.weekNumber != null && opts.totalWeeks != null) {
          const liftKey = getLiftKey(pe.name);
          if (liftKey) {
            const baseline = opts.strengthSetup.lifts.find(l => l.key === liftKey);
            if (baseline) {
              const prescription = prescribeWeekLoad(
                baseline.estimated1RM, pe.intensity, opts.weekNumber, opts.totalWeeks,
              );
              targetWeight = prescription?.kg ?? baseline.workingWeightKg;
            }
          }
        }

        // Detect single-side timed exercises ("30s each side", "25s each leg") so the
        // workout UI can show sequential Left → Right countdown timers instead of one combined timer.
        // isPerSide: true for working exercises prescribing separate work per leg/side/arm.
        // Excluded for warm-up/mobility exercises (e.g. Hip 90/90, World's Greatest Stretch)
        // which use "each side" descriptively but are performed as a single unit.
        const isPerSide = !exercise.isWarmup && /\beach\b/i.test(pe.reps);

        result.push({
          exerciseId: id,
          targetSets,
          targetReps,
          targetWeight,
          restSeconds,
          blockTitle: isFirstInBlock ? block.title : undefined,
          displayName: pe.name !== exercise.name ? pe.name : undefined,
          coachingCue: pe.cue || undefined,
          hasPrimingSingles: !isCond && isPrimingEligible(exercise),
          isPerSide: isPerSide || undefined,
          methodType: pe.methodType || undefined,
        });
        isFirstInBlock = false;
      }
    }
  }

  return result.slice(0, 25);
}
