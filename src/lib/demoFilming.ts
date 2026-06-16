// ─────────────────────────────────────────────────────────────────────────────
//  DEMO FILMING ACCOUNT — populated account for social-media recordings.
//
//  Account-gated: this only ever activates for demo@vectorfootball.co.uk (same
//  password as the App Review account). The App reviewer signs in with review@
//  — which stays clean and data-free — so they never see any of this. The
//  "Demo data" toggle in Profile is likewise shown ONLY when logged in as demo@.
//
//  Signing in as demo@ sets up a complete profile, unlocks Premium (so you can
//  film the paid features), and seeds a lived-in history. The Profile toggle
//  lets you clear it (to film empty states) and reload it.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  UserProfile, PremiumStatus, WorkoutSession, DailyReadiness, ReadinessLevel,
  TestSession, WeightEntry, MatchEntry, BaselineTest, BaselineResults,
} from '../types';
import { APP_REVIEW_PASSWORD } from './appReviewDemo';

export const DEMO_FILMING_EMAIL = 'demo@vectorfootball.co.uk';

const STORAGE_SYNC_EVENT = 'vf-storage-sync';
const SEEDED_FLAG = 'vf_demo_seeded';
const SEED_VERSION_KEY = 'vf_demo_seed_version';
const DEMO_SEED_VERSION = 'filming-realistic-v4';

// Keys the seeder fills (so clearDemoData wipes exactly these).
const KEY_SESSIONS = 'vf_sessions';
const KEY_READINESS = 'vf_daily_readiness';
const KEY_TESTS = 'vf_test_sessions';
const KEY_WEIGHT = 'vf_weight_log';
const KEY_MATCHES = 'vf_match_entries';
const KEY_BASELINE = 'vf_baseline';

// Mirror appReviewDemo's broadcast so live useLocalStorage hooks update.
function writeSynced(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  localStorage.setItem(key, serialized);
  window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key, serialized } }));
}

export function isDemoFilmingLogin(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_FILMING_EMAIL && password === APP_REVIEW_PASSWORD;
}

export function isDemoSeeded(): boolean {
  return localStorage.getItem(SEEDED_FLAG) === '1' && localStorage.getItem(SEED_VERSION_KEY) === DEMO_SEED_VERSION;
}

export function isDemoFilmingProfile(profile?: Pick<UserProfile, 'email'> | null): boolean {
  return profile?.email?.trim().toLowerCase() === DEMO_FILMING_EMAIL;
}

export function needsDemoDataRefresh(profile?: Pick<UserProfile, 'email'> | null): boolean {
  return isDemoFilmingProfile(profile) && !isDemoSeeded();
}

// ── date helpers (local time to avoid TZ edge cases) ─────────────────────────
function ymd(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ts(daysAgo: number, hour = 18): number {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

function buildSession(
  daysAgo: number,
  name: string,
  exes: Array<[string, number, number, number, Array<[number, number, number?]>?]>, // [exerciseId, target sets/reps/weight, actual sets]
  opts: { hour?: number; durationMin?: number; rpe?: number; notes?: string; flagged?: string[] } = {},
): WorkoutSession {
  const start = ts(daysAgo, opts.hour ?? 18);
  return {
    id: `demo-sess-${daysAgo}`,
    name,
    exercises: exes.map(([exerciseId, targetSets, targetReps, targetWeight, actualSets]) => ({
      exerciseId,
      targetSets,
      targetReps,
      targetWeight,
      restSeconds: targetReps <= 5 ? 150 : 90,
      targetRir: targetReps <= 5 ? 2 : 3,
      sets: (actualSets ?? Array.from({ length: targetSets }, () => [targetReps, targetWeight, 2] as [number, number, number])).map(([reps, weight, rir], i) => ({
        reps,
        weight,
        completedAt: start + (i + 1) * 3 * 60_000,
        rir,
      })),
    })),
    startTime: start,
    endTime: start + (opts.durationMin ?? 55) * 60_000,
    date: ymd(daysAgo),
    ...(opts.notes ? { notes: opts.notes } : {}),
    ...(opts.flagged ? { flaggedExercises: opts.flagged } : {}),
    sessionRpe: opts.rpe ?? 7,
  };
}

function demoSessions(): WorkoutSession[] {
  return [
    buildSession(0, 'Lower Body — Sharpness', [
      ['front-squat', 3, 3, 80, [[3, 80, 3], [3, 80, 3], [3, 80, 2]]],
      ['leg-press', 2, 8, 155, [[8, 155, 3], [8, 155, 3]]],
      ['face-pull', 2, 15, 20, [[15, 20, 4], [15, 20, 4]]],
    ], { hour: 10, durationMin: 39, rpe: 5, notes: 'Short activation lift. Felt fresher than yesterday.' }),
    buildSession(1, 'Upper Body — Maintenance', [
      ['bench-press', 3, 5, 77.5, [[5, 77.5, 2], [5, 77.5, 2], [4, 77.5, 1]]],
      ['pull-up', 3, 7, 0, [[8, 0, 2], [7, 0, 2], [6, 0, 1]]],
      ['face-pull', 2, 15, 22.5, [[15, 22.5, 3], [14, 22.5, 3]]],
    ], { hour: 17, durationMin: 43, rpe: 6, notes: 'Kept it short after Sunday match.' }),
    buildSession(4, 'Lower Body — Reload', [
      ['front-squat', 3, 4, 82.5, [[4, 82.5, 2], [4, 82.5, 2], [3, 82.5, 1]]],
      ['deadlift', 2, 4, 115, [[4, 115, 2], [4, 115, 2]]],
      ['leg-press', 2, 10, 165, [[10, 165, 3], [9, 165, 2]]],
    ], { hour: 18, durationMin: 51, rpe: 7 }),
    buildSession(8, 'Upper Body — Push/Pull', [
      ['bench-press', 4, 6, 80, [[6, 80, 2], [6, 80, 2], [5, 80, 1], [5, 77.5, 2]]],
      ['lat-pulldown', 3, 10, 72.5, [[10, 72.5, 2], [9, 72.5, 2], [9, 70, 2]]],
      ['incline-bench', 3, 8, 57.5, [[8, 57.5, 2], [8, 57.5, 2], [7, 57.5, 1]]],
      ['face-pull', 2, 15, 25, [[15, 25, 3], [15, 25, 3]]],
    ], { hour: 19, durationMin: 61, rpe: 8 }),
    buildSession(11, 'Lower Body — Strength', [
      ['squat', 4, 5, 100, [[5, 100, 2], [5, 100, 2], [4, 100, 1], [4, 97.5, 1]]],
      ['deadlift', 3, 4, 125, [[4, 125, 2], [4, 125, 1], [3, 125, 1]]],
      ['leg-press', 3, 8, 185, [[8, 185, 2], [8, 185, 2], [7, 185, 1]]],
    ], { hour: 18, durationMin: 67, rpe: 9, notes: 'Heavy legs. Left hamstring felt tight on last deadlift.', flagged: ['deadlift'] }),
    buildSession(15, 'Upper Body — Easy Volume', [
      ['db-bench', 3, 8, 32, [[8, 32, 3], [8, 32, 3], [8, 32, 2]]],
      ['pull-up', 3, 7, 0, [[7, 0, 3], [7, 0, 2], [6, 0, 2]]],
      ['face-pull', 3, 15, 22.5, [[15, 22.5, 3], [15, 22.5, 3], [14, 22.5, 3]]],
    ], { hour: 16, durationMin: 46, rpe: 5 }),
    buildSession(18, 'Lower Body — Power', [
      ['front-squat', 4, 3, 85, [[3, 85, 2], [3, 85, 2], [3, 85, 2], [2, 85, 1]]],
      ['deadlift', 3, 3, 130, [[3, 130, 2], [3, 130, 1], [2, 130, 1]]],
      ['leg-press', 2, 8, 190, [[8, 190, 2], [7, 190, 1]]],
    ], { hour: 18, durationMin: 58, rpe: 8 }),
    buildSession(23, 'Upper Body — Strength', [
      ['bench-press', 4, 5, 82.5, [[5, 82.5, 2], [5, 82.5, 2], [5, 82.5, 1], [4, 82.5, 1]]],
      ['lat-pulldown', 4, 8, 72.5, [[8, 72.5, 2], [8, 72.5, 2], [7, 72.5, 1], [7, 70, 2]]],
      ['close-grip-bench', 3, 8, 62.5, [[8, 62.5, 2], [8, 62.5, 2], [7, 62.5, 1]]],
    ], { hour: 18, durationMin: 64, rpe: 8 }),
    buildSession(26, 'Lower Body — Strength', [
      ['squat', 4, 5, 97.5, [[5, 97.5, 2], [5, 97.5, 2], [5, 97.5, 1], [4, 97.5, 1]]],
      ['leg-press', 3, 10, 175, [[10, 175, 2], [10, 175, 2], [9, 175, 1]]],
      ['deadlift', 2, 5, 115, [[5, 115, 2], [5, 115, 2]]],
    ], { hour: 18, durationMin: 59, rpe: 7 }),
    buildSession(33, 'Upper Body — Deload', [
      ['bench-press', 3, 6, 72.5, [[6, 72.5, 4], [6, 72.5, 3], [6, 72.5, 3]]],
      ['pull-up', 2, 6, 0, [[6, 0, 3], [6, 0, 3]]],
      ['face-pull', 2, 15, 20, [[15, 20, 4], [15, 20, 4]]],
    ], { hour: 17, durationMin: 38, rpe: 4, notes: 'Deload after congested week.' }),
    buildSession(38, 'Lower Body — Accumulation', [
      ['squat', 4, 6, 90, [[6, 90, 3], [6, 90, 2], [6, 90, 2], [5, 90, 2]]],
      ['deadlift', 3, 5, 112.5, [[5, 112.5, 2], [5, 112.5, 2], [4, 112.5, 2]]],
      ['leg-press', 3, 10, 170, [[10, 170, 2], [10, 170, 2], [10, 170, 1]]],
    ], { hour: 18, durationMin: 62, rpe: 7 }),
    buildSession(44, 'Upper Body — Push/Pull', [
      ['bench-press', 4, 6, 77.5, [[6, 77.5, 2], [6, 77.5, 2], [6, 77.5, 1], [5, 77.5, 1]]],
      ['lat-pulldown', 3, 10, 70, [[10, 70, 2], [10, 70, 2], [9, 70, 2]]],
      ['db-bench', 2, 8, 30, [[8, 30, 3], [8, 30, 3]]],
    ], { hour: 19, durationMin: 56, rpe: 7 }),
    buildSession(50, 'Lower Body — Return To Load', [
      ['front-squat', 3, 5, 77.5, [[5, 77.5, 3], [5, 77.5, 3], [5, 77.5, 2]]],
      ['deadlift', 2, 5, 105, [[5, 105, 3], [5, 105, 2]]],
      ['leg-press', 2, 10, 160, [[10, 160, 3], [10, 160, 2]]],
    ], { hour: 17, durationMin: 49, rpe: 6 }),
    buildSession(58, 'Upper Body — Base', [
      ['bench-press', 3, 6, 72.5, [[6, 72.5, 3], [6, 72.5, 3], [5, 72.5, 2]]],
      ['lat-pulldown', 3, 10, 65, [[10, 65, 3], [10, 65, 2], [9, 65, 2]]],
      ['face-pull', 2, 15, 20, [[15, 20, 4], [15, 20, 4]]],
    ], { hour: 18, durationMin: 50, rpe: 6 }),
    buildSession(65, 'Lower Body — Base', [
      ['squat', 3, 5, 87.5, [[5, 87.5, 3], [5, 87.5, 3], [5, 87.5, 2]]],
      ['deadlift', 2, 5, 100, [[5, 100, 3], [5, 100, 2]]],
      ['leg-press', 2, 10, 150, [[10, 150, 3], [10, 150, 3]]],
    ], { hour: 17, durationMin: 52, rpe: 6 }),
    buildSession(72, 'Upper Body — Rebuild', [
      ['db-bench', 3, 8, 28, [[8, 28, 3], [8, 28, 3], [8, 28, 2]]],
      ['pull-up', 3, 6, 0, [[6, 0, 3], [6, 0, 3], [5, 0, 2]]],
      ['face-pull', 2, 15, 20, [[15, 20, 4], [14, 20, 4]]],
    ], { hour: 19, durationMin: 44, rpe: 5 }),
  ];
}

function demoReadiness(): DailyReadiness[] {
  const presets: Array<[number, number, ReadinessLevel, number, number, number, number, number, number, number, number, number, number, number]> = [
    // days, score, level, sleep, fatigue, soreness, stress, sleepH, deep, rem, awake, HRV, RHR, fatigueScore
    [0, 3.7, 'moderate', 4, 3, 3, 2, 7.1, 1.1, 1.6, 0.7, 54, 56, 67],
    [1, 2.8, 'low',      3, 4, 4, 3, 6.2, 0.8, 1.2, 1.0, 45, 61, 42],
    [2, 3.3, 'moderate', 3, 3, 4, 2, 6.8, 1.0, 1.4, 0.6, 50, 58, 55],
    [3, 4.1, 'high',     4, 2, 2, 2, 7.7, 1.4, 1.9, 0.4, 63, 52, 82],
    [4, 4.5, 'elite',    5, 2, 2, 1, 8.3, 1.7, 2.0, 0.3, 68, 49, 91],
    [5, 3.5, 'moderate', 3, 3, 3, 3, 6.9, 1.0, 1.5, 0.5, 56, 55, 66],
    [7, 4.2, 'high',     4, 2, 2, 2, 7.8, 1.5, 1.8, 0.4, 64, 50, 84],
    [8, 3.8, 'high',     4, 3, 2, 2, 7.2, 1.2, 1.6, 0.5, 59, 53, 75],
    [10, 3.0, 'moderate',3, 4, 3, 4, 6.1, 0.7, 1.1, 1.2, 47, 60, 46],
    [11, 4.0, 'high',    4, 2, 2, 2, 7.6, 1.3, 1.8, 0.4, 61, 52, 79],
    [13, 2.6, 'low',     2, 4, 4, 3, 5.9, 0.6, 1.0, 1.3, 42, 63, 35],
    [15, 3.9, 'high',    4, 2, 3, 2, 7.4, 1.3, 1.7, 0.5, 60, 53, 77],
    [18, 4.4, 'high',    5, 2, 2, 1, 8.1, 1.6, 1.9, 0.3, 66, 50, 88],
    [21, 3.2, 'moderate',3, 3, 3, 3, 6.7, 0.9, 1.4, 0.8, 51, 58, 55],
    [25, 4.1, 'high',    4, 2, 2, 2, 7.9, 1.5, 1.8, 0.4, 62, 51, 82],
  ];
  return presets.map(([daysAgo, score, level, sleep, fatigue, soreness, stress, sleepHours, deepSleepHours, remSleepHours, awakeHours, hrvMs, restingHr, fatigueScore]) => ({
    date: ymd(daysAgo),
    sleep,
    fatigue,
    soreness,
    stress,
    sleepHours,
    deepSleepHours,
    remSleepHours,
    awakeHours,
    sleepScore: Math.round(Math.min(98, Math.max(38, sleepHours * 10.5 + deepSleepHours * 7 + remSleepHours * 3 - awakeHours * 12))),
    fatigueScore,
    hrvMs,
    restingHr,
    score,
    level,
    completedAt: ts(daysAgo, daysAgo % 3 === 0 ? 9 : 8),
  }));
}

function demoTests(): TestSession[] {
  return [
    {
      id: 'demo-test-3',
      date: ymd(9),
      completedAt: ts(9, 17),
      sex: 'male',
      selectedTests: ['10m', '30m', 'cmj', 'broad_jump', 'rsa', 'yoyo'],
      results: [
        { type: '10m', attempts: [1.84, 1.80, 1.82], best: 1.80, skipped: false },
        { type: '30m', attempts: [4.25, 4.16, 4.18], best: 4.16, skipped: false },
        { type: 'cmj', attempts: [38.5, 40.1, 39.4], best: 40.1, skipped: false },
        { type: 'broad_jump', attempts: [244, 250, 247], best: 250, skipped: false },
        { type: 'rsa', attempts: [4.32], best: 4.32, skipped: false, rsaAllSprints: [4.32, 4.37, 4.41, 4.48, 4.50, 4.55], rsaMeanTime: 4.44, rsaBestTime: 4.32, fatigueIndex: 5.3 },
        { type: 'yoyo', attempts: [18.4], best: 18.4, skipped: false },
      ],
      grades: { '10m': 3, '30m': 3, cmj: 3, broad_jump: 4, rsa: 2, rsa_fi: 3, yoyo: 3 },
      aerobicScore: 60,
      anaerobicScore: 63,
    },
    {
      id: 'demo-test-2',
      date: ymd(42),
      completedAt: ts(42, 18),
      sex: 'male',
      selectedTests: ['10m', '30m', 'cmj', 'broad_jump', 'rsa', 'yoyo'],
      results: [
        { type: '10m', attempts: [1.89, 1.86], best: 1.86, skipped: false },
        { type: '30m', attempts: [4.34, 4.28], best: 4.28, skipped: false },
        { type: 'cmj', attempts: [36.8, 38.2, 37.9], best: 38.2, skipped: false },
        { type: 'broad_jump', attempts: [238, 242], best: 242, skipped: false },
        { type: 'rsa', attempts: [4.40], best: 4.40, skipped: false, rsaAllSprints: [4.40, 4.45, 4.49, 4.56, 4.61, 4.66], rsaMeanTime: 4.53, rsaBestTime: 4.40, fatigueIndex: 6.1 },
        { type: 'yoyo', attempts: [17.8], best: 17.8, skipped: false },
      ],
      grades: { '10m': 2, '30m': 3, cmj: 2, broad_jump: 3, rsa: 1, rsa_fi: 3, yoyo: 2 },
      anaerobicScore: 50,
      aerobicScore: 45,
    },
    {
      id: 'demo-test-1',
      date: ymd(76),
      completedAt: ts(76, 17),
      sex: 'male',
      selectedTests: ['10m', '30m', 'cmj', 'broad_jump', 'rsa', 'yoyo'],
      results: [
        { type: '10m', attempts: [1.93, 1.90], best: 1.90, skipped: false },
        { type: '30m', attempts: [4.42, 4.36], best: 4.36, skipped: false },
        { type: 'cmj', attempts: [35.2, 36.4], best: 36.4, skipped: false },
        { type: 'broad_jump', attempts: [232, 236], best: 236, skipped: false },
        { type: 'rsa', attempts: [4.49], best: 4.49, skipped: false, rsaAllSprints: [4.49, 4.55, 4.62, 4.69, 4.75, 4.82], rsaMeanTime: 4.65, rsaBestTime: 4.49, fatigueIndex: 7.3 },
        { type: 'yoyo', attempts: [17.1], best: 17.1, skipped: false },
      ],
      grades: { '10m': 2, '30m': 2, cmj: 2, broad_jump: 3, rsa: 1, rsa_fi: 2, yoyo: 2 },
      aerobicScore: 40,
      anaerobicScore: 45,
    },
  ];
}

function demoBaseline(): { test: BaselineTest; results: BaselineResults; savedAt: number } {
  const completedAt = ts(9, 17);
  return {
    test: {
      sprint10m: 1.80,
      sprint30m: 4.16,
      cmjBest: 40.1,
      broadJumpBest: 250,
      rsaSprints: [4.32, 4.37, 4.41, 4.48, 4.50, 4.55],
      yoyoLevel: 18.4,
      sex: 'male',
      completedAt,
    },
    results: {
      sprint10mGrade: 3,
      sprint30mGrade: 3,
      cmjGrade: 3,
      broadJumpGrade: 4,
      rsaBestTime: 4.32,
      rsaMeanTime: 4.44,
      rsaWorstTime: 4.55,
      rsaGrade: 2,
      fatigueIndex: 5.3,
      fiGrade: 3,
      yoyoGrade: 3,
      aerobicScore: 60,
      anaerobicScore: 63,
    },
    savedAt: completedAt,
  };
}

function demoWeight(): WeightEntry[] {
  const pts: Array<[number, number]> = [[56, 75.8], [49, 75.4], [42, 75.6], [35, 75.1], [28, 75.0], [21, 74.7], [14, 74.9], [7, 74.4], [1, 74.6]];
  return pts.map(([daysAgo, weightKg]) => ({ date: ymd(daysAgo), weightKg, recordedAt: ts(daysAgo, 7) }));
}

function demoMatches(): MatchEntry[] {
  return [
    { id: 'demo-m0', date: ymd(0), type: 'team_training', minutes: 82, intensity: 4 },
    { id: 'demo-m1', date: ymd(2), type: 'match', label: 'League vs City', minutes: 90, intensity: 4, performanceRating: 4, physicalIncidents: 'Calves tight final 15 mins.' },
    { id: 'demo-m2', date: ymd(5), type: 'team_training', minutes: 72, intensity: 3 },
    { id: 'demo-m3', date: ymd(9), type: 'match', label: 'Cup vs Rovers', minutes: 81, intensity: 5, performanceRating: 4 },
    { id: 'demo-m4', date: ymd(13), type: 'team_training', minutes: 64, intensity: 2 },
    { id: 'demo-m5', date: ymd(16), type: 'match', label: 'League vs United', minutes: 90, intensity: 4, performanceRating: 3, physicalIncidents: 'Heavy pitch, left adductor a bit grumbly after.' },
    { id: 'demo-m6', date: ymd(20), type: 'team_training', minutes: 80, intensity: 4 },
    { id: 'demo-m7', date: ymd(23), type: 'match', label: 'Friendly vs Albion', minutes: 63, intensity: 3, performanceRating: 3 },
    { id: 'demo-m8', date: ymd(30), type: 'match', label: 'League vs Rangers', minutes: 90, intensity: 5, performanceRating: 5 },
    { id: 'demo-m9', date: ymd(34), type: 'team_training', minutes: 58, intensity: 2 },
    { id: 'demo-m10', date: ymd(37), type: 'match', label: 'League vs Athletic', minutes: 74, intensity: 4, performanceRating: 3 },
    { id: 'demo-m11', date: ymd(44), type: 'team_training', minutes: 70, intensity: 3 },
    { id: 'demo-m12', date: ymd(51), type: 'match', label: 'Cup vs Wanderers', minutes: 88, intensity: 4, performanceRating: 4 },
    { id: 'demo-m13', date: ymd(59), type: 'team_training', minutes: 66, intensity: 3 },
    { id: 'demo-m14', date: ymd(66), type: 'match', label: 'League vs Borough', minutes: 72, intensity: 4, performanceRating: 3 },
    { id: 'demo-m15', date: ymd(73), type: 'team_training', minutes: 62, intensity: 2 },
    { id: 'demo-m16', date: ymd(80), type: 'match', label: 'Friendly vs County', minutes: 69, intensity: 3, performanceRating: 3 },
  ];
}

function demoPremium(): PremiumStatus {
  return {
    isPremium: true,
    plan: 'yearly',
    purchasedAt: ts(30),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
}

/** Seed a lived-in athlete account (data + Premium). Used on demo@ login and the toggle. */
export function seedDemoData() {
  writeSynced(KEY_SESSIONS, demoSessions());
  writeSynced(KEY_READINESS, demoReadiness());
  writeSynced(KEY_TESTS, demoTests());
  writeSynced(KEY_WEIGHT, demoWeight());
  writeSynced(KEY_MATCHES, demoMatches());
  writeSynced(KEY_BASELINE, demoBaseline());
  writeSynced('vf_premium', demoPremium());
  localStorage.setItem(SEEDED_FLAG, '1');
  localStorage.setItem(SEED_VERSION_KEY, DEMO_SEED_VERSION);
}

/** Clear the seeded training data (back to empty states for filming). Keeps Premium on. */
export function clearDemoData() {
  writeSynced(KEY_SESSIONS, []);
  writeSynced(KEY_READINESS, []);
  writeSynced(KEY_TESTS, []);
  writeSynced(KEY_WEIGHT, []);
  writeSynced(KEY_MATCHES, []);
  writeSynced(KEY_BASELINE, null);
  localStorage.removeItem(SEEDED_FLAG);
  localStorage.removeItem(SEED_VERSION_KEY);
}

/** Activate the demo filming account: profile + Premium + seeded data. */
export function activateDemoFilming() {
  const now = Date.now();
  const profile: UserProfile = {
    firstName: 'Demo',
    lastName: 'Account',
    email: DEMO_FILMING_EMAIL,
    position: 'CM',
    experienceYears: '3-5',
    gymFrequency: '3-4',
    goals: ['speed', 'strength', 'endurance'],
    gymAccess: 'full',
    completedAt: now,
    termsAcceptedAt: now,
    dateOfBirth: '2001-01-01',
    heightCm: 180,
    weightKg: 74,
    gender: 'male',
    accountType: 'personal',
  };
  localStorage.setItem('vf_data_owner', 'demo-filming');
  writeSynced('vf_user_profile', profile);
  seedDemoData();
  sessionStorage.setItem('vf_boot_synced', '1');
}
