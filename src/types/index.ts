export type ExerciseCategory =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'
  | 'Full Body'
  | 'Isometric'
  | 'Plyometrics'
  | 'Speed'
  | 'Agility'
  | 'Eccentric'
  | 'Conditioning'
  | 'Testing';

// How a completed set is measured — determines what inputs appear in ActiveWorkout
export type MeasureType =
  | 'strength'   // weight (kg) × reps  — default
  | 'reps'       // reps only, no weight
  | 'time'       // seconds — for sprints, conditioning intervals
  | 'distance'   // metres — for jumps, bounds
  | 'height'     // centimetres — for CMJ, box jump height
  | 'score';     // free numeric — Yo-Yo level, 30-15 speed, etc.

// Primary training classification — determines progression logic
export type PrimaryCategory =
  | 'strength'           // max force — progress by load
  | 'power'             // rate of force — progress by output (height/distance/velocity)
  | 'acceleration'      // 0–30m speed — max effort, full recovery
  | 'deceleration'      // braking mechanics
  | 'change-of-direction'
  | 'resilience'        // injury prevention (eccentric, isometric)
  | 'conditioning';     // aerobic/anaerobic capacity — progress by volume/load

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryCategory?: PrimaryCategory;
  footballTransfer?: 'low' | 'medium' | 'high';
  defaultRestSeconds: number;
  muscleGroups: string[];
  measureType?: MeasureType;   // defaults to 'strength' when absent
  unit?: string;               // display label override e.g. 's', 'm', 'cm', 'N/kg'
  suggestedRir?: number;       // 0–4 recommended RIR for this exercise
  secondaryCategory?: ExerciseCategory;  // optional second category label
  isCustom?: boolean;
  isWarmup?: boolean;    // suppresses history/PB display in active workout
}

export interface WorkoutExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
  targetRir?: number;    // 0–4, target Reps in Reserve (0 = max, 4 = very easy)
  blockTitle?: string;   // section heading shown before this exercise in active workout
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  createdAt: number;
}

export interface CompletedSet {
  reps: number;
  weight: number;
  completedAt: number;
  rir?: number;          // 0–4, Reps in Reserve actually achieved
}

export interface SessionExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
  targetRir?: number;    // carried from WorkoutExercise
  blockTitle?: string;   // carried from WorkoutExercise
  sets: CompletedSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  templateId?: string;
  exercises: SessionExercise[];
  startTime: number;
  endTime?: number;
  date: string;
}

// ── Training Plans ────────────────────────────────────────────────────────

export interface PlanSession {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday … 6 = Sunday
  templateId: string;
  name: string;
  tags: string[];
}

export interface PlanWeek {
  weekNumber: number;
  phase: string;
  sessions: PlanSession[];
}

export interface PositionPlan {
  id: string;
  position: string;
  shortName: string;
  description: string;
  weeks: PlanWeek[];
}

export interface ActivePlan {
  planId: string;
  startDate: string; // YYYY-MM-DD (the Monday of week 1)
}

// ── Daily Readiness ───────────────────────────────────────────────────────

export interface DailyReadiness {
  date: string;           // YYYY-MM-DD
  sleep: number;          // 1–5 (5=best)
  fatigue: number;        // 1–5 (1=best, 5=worst)
  soreness: number;       // 1–5 (1=best, 5=worst)
  stress: number;         // 1–5 (1=best, 5=worst)
  score: number;          // computed 1–5
  level: 'elite' | 'high' | 'moderate' | 'low';
  completedAt: number;    // timestamp
}

// ── User Settings ─────────────────────────────────────────────────────────

export interface UserSettings {
  showTutorialVideos: boolean;   // show demo videos & how-to guides in workouts + exercise detail
  showRir: boolean;              // show Reps-in-Reserve selector after each set
}

export const DEFAULT_SETTINGS: UserSettings = {
  showTutorialVideos: true,
  showRir: true,
};

// ── User Profile / Onboarding ─────────────────────────────────────────────

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  position: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  experienceYears: '<1' | '1-3' | '3-5' | '5+';
  gymFrequency: '0' | '1-2' | '3-4' | '5+';
  goals: string[];           // e.g. ['speed', 'strength', 'endurance']
  gymAccess: 'full' | 'basic' | 'none';
  completedAt: number;       // timestamp
  passwordHash?: string;     // SHA-256 hex of password (local auth only)
  // Optional profile details collected during onboarding
  heightCm?: number;
  weightKg?: number;
  gender?: 'male' | 'female' | 'other';
}

// ── Fitness Baseline / Testing Battery ───────────────────────────────────

export interface BaselineTest {
  sprint10m?: number;       // seconds (standing start)
  sprint30m?: number;       // seconds (standing start)
  cmjBest?: number;         // centimetres (best of 3 trials)
  rsaSprints?: number[];    // array of 6 sprint times in seconds (30m each)
  yoyoLevel?: number;       // Yo-Yo IR1 level reached (e.g. 17.5 = level 17, shuttle 5)
  sex?: 'male' | 'female';
  completedAt: number;
}

export interface BaselineResults {
  // RSA-derived
  rsaBestTime?: number;
  rsaMeanTime?: number;
  rsaWorstTime?: number;
  fatigueIndex?: number;         // % — Girard et al. 2011 formula
  // Classifications 1–4 (1=poor, 2=average, 3=good, 4=excellent)
  sprint10mGrade?: 1|2|3|4;
  sprint30mGrade?: 1|2|3|4;
  cmjGrade?: 1|2|3|4;
  rsaGrade?: 1|2|3|4;
  fiGrade?: 1|2|3|4;
  yoyoGrade?: 1|2|3|4;
  // Overall energy system profile
  anaerobicScore?: number;       // 0–100
  aerobicScore?: number;         // 0–100
}

// ── Performance Tracking ──────────────────────────────────────────────────

export type PerformanceMetric =
  | 'sprint_10m'         // seconds
  | 'sprint_20m'         // seconds
  | 'sprint_30m'         // seconds
  | 'cmj'               // cm
  | 'broad_jump'        // m
  | 'rsa_fatigue_index'; // %

export interface PerformanceEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  metric: PerformanceMetric;
  value: number;
}

// ── Match Load Management ─────────────────────────────────────────────────

export type MatchEntryType = 'match' | 'team_training';

export interface MatchEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  type: MatchEntryType;
  label?: string;        // optional e.g. "League vs City"
  minutes?: number;      // minutes played (for load adjustment, 1–90+)
  intensity?: number;    // post-session intensity rating 1–5
}

export type LoadDay = 'MD' | 'MD-1' | 'MD-2' | 'MD-3' | 'MD+1' | 'MD+2' | 'free';

// ── Navigation ────────────────────────────────────────────────────────────

export type Screen =
  | 'dashboard'
  | 'exercise-library'
  | 'workout-builder'
  | 'active-workout'
  | 'history'
  | 'exercise-detail'
  | 'plans'
  | 'plan-detail'
  | 'profile'
  | 'testing-battery'
  | 'load-calendar'
  | 'programme-builder'
  | 'generated-programme'
  | 'reset-password';

export interface NavState {
  screen: Screen;
  exerciseId?: string;
  templateId?: string;
  sessionId?: string;
  planId?: string;
}

// ── AI Programme Builder ──────────────────────────────────────────────────

export type PrimaryGoal = 'speed' | 'strength' | 'power' | 'endurance' | 'injury_prevention';
export type MatchDayPref = 'saturday' | 'sunday' | 'midweek';
export type GameDayPref = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Weakness = 'speed' | 'strength' | 'endurance' | 'power' | 'agility' | 'injury_prone';
export type InjuryArea = 'hamstring' | 'ankle' | 'knee' | 'groin' | 'calf' | 'back' | 'shoulder';
export type PlayStyle = 'box-to-box' | 'direct' | 'technical' | 'physical' | 'press-heavy' | 'counter-attack';
export type FVEmphasis = 'speed' | 'strength' | 'balanced';
// 4-band readiness: 1–3 low, 4–6 moderate, 7–8 high, 9–10 elite
export type ReadinessLevel = 'elite' | 'high' | 'moderate' | 'low';
export type MethodType = 'concentric' | 'eccentric' | 'isometric' | 'reactive' | 'mixed';
export type IntensityIntent = 'explosive' | 'maximal' | 'controlled' | 'moderate' | 'submaximal' | 'reactive';

export interface ProgrammeInputs {
  position: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  secondaryPosition?: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  playStyle: PlayStyle;
  experienceYears: '<1' | '1-3' | '3-5' | '5+';
  sessionsPerWeek: 2 | 3 | 4;
  primaryGoal: PrimaryGoal;
  secondaryGoals: string[];
  matchDay: MatchDayPref;
  secondMatchDay?: GameDayPref;
  biggestWeakness: Weakness;
  injuryHistory: InjuryArea[];
  readiness?: { sleep: number; fatigue: number; soreness: number; stress: number };
  gymAccess: 'full' | 'basic' | 'none';
  fvEmphasis?: FVEmphasis; // always 'balanced' — kept for historical data compatibility
  offSeason?: boolean;     // when true: no match-day periodisation, DOMS/fatigue managed only
  customDurationWeeks?: number; // user-chosen programme length (overrides experience-based default)
  preferBackSquat?: boolean;   // player enjoys/prefers Back Squat — enables selection in eligible phases
}

export interface ProgrammeExercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  intensity?: string;
  tempo?: string;           // e.g. "3-0-1-0" (eccentric-pause-concentric-pause)
  methodType?: MethodType;
  intensityIntent?: IntensityIntent;
  isRunning?: boolean;      // true = pitch/speed/agility work → split to Conditioning session
  cue: string;
}

export interface SessionBlock {
  title: string;
  methodFocus?: string;     // e.g. "Eccentric loading — hamstring resilience"
  exercises: ProgrammeExercise[];
}

export interface ProgrammeSession {
  mdDay: string;
  dayOfWeek: string;
  objective: string;
  readinessNote: string;
  durationMin: number;
  fvProfile: string;        // e.g. "Speed end of F-V curve — low load, maximum velocity"
  blocks: SessionBlock[];
}

export interface ProgrammeWeek {
  weekNumber: number;
  phase: string;
  phaseGoal: string;
  sessions: ProgrammeSession[];
}

export interface GeneratedProgramme {
  id: string;
  createdAt: number;
  title: string;
  summary: string;
  coachExplanation: string;  // Why this plan is structured this way
  readinessScore: number;
  readinessLevel: ReadinessLevel;
  readinessGuidance: string;
  durationWeeks: number;
  inputs: ProgrammeInputs;
  weeks: ProgrammeWeek[];
}

// ── Testing Engine ─────────────────────────────────────────────────────────

export type TestType = '10m' | '30m' | 'cmj' | 'broad_jump' | 'rsa' | 'yoyo';

export interface SingleTestResult {
  type: TestType;
  /** All recorded attempt values (seconds / cm / m / level depending on type) */
  attempts: number[];
  /** Best value — lowest for time tests, highest for distance/height/level */
  best: number;
  skipped: boolean;
  // RSA-specific
  rsaAllSprints?: number[];  // 6 entered sprint times (seconds)
  rsaMeanTime?: number;
  rsaBestTime?: number;
  fatigueIndex?: number;     // % (Girard et al. 2011)
}

export interface TestSession {
  id: string;
  date: string;              // YYYY-MM-DD
  completedAt: number;
  sex: 'male' | 'female';
  selectedTests: TestType[];
  results: SingleTestResult[];
  /** Grading per test type, plus 'rsa_fi' for fatigue index */
  grades: Partial<Record<string, 1 | 2 | 3 | 4>>;
  aerobicScore?: number;     // 0–100
  anaerobicScore?: number;   // 0–100
}
