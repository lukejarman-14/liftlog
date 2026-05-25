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
  displayName?: string;  // programme-specific exercise name (overrides library name in header)
  coachingCue?: string;  // programme-specific coaching cue (shown in tutorial panel)
  hasPrimingSingles?: boolean; // inject 3 ascending neural priming singles before working sets
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
  isPriming?: boolean;   // true for neural priming singles (85/92/100% of working weight)
}

export interface SessionExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
  targetRir?: number;    // carried from WorkoutExercise
  blockTitle?: string;   // carried from WorkoutExercise
  displayName?: string;  // carried from WorkoutExercise
  coachingCue?: string;  // carried from WorkoutExercise
  hasPrimingSingles?: boolean; // carried from WorkoutExercise
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
  notes?: string;                  // free-text player notes added at finish
  flaggedExercises?: string[];     // exerciseIds flagged as painful/problematic
}


export interface WeightEntry {
  date: string;      // YYYY-MM-DD
  weightKg: number;
  recordedAt: number; // timestamp
}


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


export interface UserSettings {
  showTutorialVideos: boolean;   // show demo videos & how-to guides in workouts + exercise detail
  showRir: boolean;              // show Reps-in-Reserve selector after each set
  reminderEnabled: boolean;      // daily training-session push notification
  reminderHour: number;          // 0-23
  reminderMinute: number;        // 0–59 (UI offers 0, 15, 30, 45)
}

export const DEFAULT_SETTINGS: UserSettings = {
  showTutorialVideos: true,
  showRir: true,
  reminderEnabled: false,
  reminderHour: 8,
  reminderMinute: 0,
};


export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  position: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  secondaryPosition?: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  experienceYears: '<1' | '1-3' | '3-5' | '5+';
  gymFrequency: '0' | '1-2' | '3-4' | '5+';
  goals: string[];           // e.g. ['speed', 'strength', 'endurance']
  gymAccess: 'full' | 'basic' | 'none';
  completedAt: number;       // timestamp
  passwordHash?: string;     // SHA-256 hex of password (local auth only)
  // Optional profile details collected during onboarding
  dateOfBirth?: string;  // ISO date string YYYY-MM-DD — age computed dynamically
  heightCm?: number;
  weightKg?: number;
  gender?: 'male' | 'female' | 'other';
}


export interface BaselineTest {
  sprint10m?: number;       // seconds (standing start)
  sprint30m?: number;       // seconds (standing start)
  cmjBest?: number;         // centimetres (best of 3 trials)
  broadJumpBest?: number;   // centimetres (best of 3 trials)
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
  fatigueIndex?: number;         // %
  // Classifications 1–4 (1=poor, 2=average, 3=good, 4=excellent)
  sprint10mGrade?: 1|2|3|4|5;
  sprint30mGrade?: 1|2|3|4|5;
  cmjGrade?: 1|2|3|4|5;
  broadJumpGrade?: 1|2|3|4|5;
  rsaGrade?: 1|2|3|4|5;
  fiGrade?: 1|2|3|4|5;
  yoyoGrade?: 1|2|3|4|5;
  // Overall energy system profile
  anaerobicScore?: number;       // 0–100
  aerobicScore?: number;         // 0–100
}


export type MatchEntryType = 'match' | 'team_training';

export interface MatchEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  type: MatchEntryType;
  label?: string;        // optional e.g. "League vs City"
  minutes?: number;      // minutes played (for load adjustment, 1–90+)
  intensity?: number;    // post-session intensity rating 1–5
  performanceRating?: number;  // 1–5 self-assessed match/training performance
  physicalIncidents?: string;  // free-text: niggles, cramps, muscle issues etc.
}

export type LoadDay = 'MD' | 'MD-1' | 'MD-2' | 'MD-3' | 'MD+1' | 'MD+2' | 'free';


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
  | 'reset-password'
  | 'paywall';

export interface NavState {
  screen: Screen;
  exerciseId?: string;
  templateId?: string;
  sessionId?: string;
  planId?: string;
}


export type PrimaryGoal = 'speed' | 'strength' | 'power' | 'endurance' | 'injury_prevention';
export type MatchDayPref = 'saturday' | 'sunday' | 'midweek';
export type GameDayPref = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Weakness = 'speed' | 'strength' | 'endurance' | 'power' | 'injury_prone';
export type InjuryArea = 'hamstring' | 'ankle' | 'knee' | 'groin' | 'calf' | 'back' | 'shoulder';
export type PlayStyle = 'box-to-box' | 'direct' | 'technical' | 'physical' | 'press-heavy' | 'counter-attack';
// 4-band readiness: 1–3 low, 4–6 moderate, 7–8 high, 9–10 elite
export type ReadinessLevel = 'elite' | 'high' | 'moderate' | 'low';
export type MethodType = 'concentric' | 'eccentric' | 'isometric' | 'reactive' | 'mixed';
export type IntensityIntent = 'explosive' | 'maximal' | 'controlled' | 'moderate' | 'submaximal' | 'reactive';

export interface ProgrammeInputs {
  position: 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST';
  playStyle: PlayStyle;
  experienceYears: '<1' | '1-3' | '3-5' | '5+';
  sessionsPerWeek: number;
  gymSessionsPerWeek?: number;
  conditioningSessionsPerWeek?: number;  // computed from conditioningTypes.length
  conditioningTypes?: ('zone2' | 'hiit' | 'rsa')[];
  matchesPerWeek?: 1 | 2 | 3;
  primaryGoal: PrimaryGoal;
  matchDay: MatchDayPref;
  secondMatchDay?: GameDayPref;
  biggestWeakness: Weakness;
  injuryHistory: InjuryArea[];
  readiness?: { sleep: number; fatigue: number; soreness: number; stress: number };
  gymAccess: 'full' | 'basic' | 'none';
  offSeason?: boolean;
  preSeason?: boolean;           // pre-season variant — no matches but match-prep conditioning included
  customDurationWeeks?: number; // user-chosen programme length (overrides experience-based default)
  preferBackSquat?: boolean;   // player enjoys/prefers Back Squat — enables selection in eligible phases
  upperPullChoice?: 'pull-up' | 'row';  // whether the player uses pull-ups or rows for the upper-pull slot
  lifts?: LiftBaseline[];      // collected during wizard for personalised load prescriptions
  testGrades?: Partial<Record<string, 1 | 2 | 3 | 4 | 5>>; // from most recent TestSession.grades — drives programme emphasis adjustments
}

export interface ProgrammeExercise {
  name: string;
  /** Resolved exercise library ID — stamped at generation time so sessionToWorkoutExercises
   *  can skip the NAME_TO_ID lookup entirely. Absent on programmes generated before this field
   *  was added; the lookup chain handles those as a backward-compatible fallback. */
  exerciseId?: string;
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


export interface LiftBaseline {
  key: string;             // LiftKey e.g. 'squat', 'hipThrust'
  exerciseName: string;    // Display name e.g. 'Back Squat'
  workingWeightKg: number; // Weight entered by user
  workingReps: number;     // Reps entered by user
  estimated1RM: number;    // Epley formula result
}

export interface StrengthSetup {
  lifts: LiftBaseline[];
  configuredAt: number;
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
  strengthSetup?: StrengthSetup;  // Progressive overload baseline
  sessionOverrides?: Record<string, string>; // sessionKey ("wi-dow") → new YYYY-MM-DD date
  conditioningRepCounts?: Record<string, number>;   // exerciseId → current interval count (auto-adjusts after each session)
  conditioningStagnation?: Record<string, number>;  // exerciseId → sessions completed at current count without increasing
  programmeStartDate?: string;                      // YYYY-MM-DD chosen by user when activating — week 1 anchors here
  skippedSessions?: Record<string, { reason: string; skippedAt: number }>; // sessionKey → skip info
}


export interface PremiumStatus {
  isPremium: boolean;
  plan?: 'monthly' | 'yearly' | 'lifetime'; // which subscription tier
  trialStartedAt?: number;               // timestamp — when 14-day trial began
  purchasedAt?: number;                  // timestamp — when they became premium
  expiresAt?: number;                    // timestamp — subscription expiry
  rcCustomerId?: string;                 // RevenueCat customer ID (set when integrating)
}


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
  fatigueIndex?: number;     // %
}

export interface TestSession {
  id: string;
  date: string;              // YYYY-MM-DD
  completedAt: number;
  sex: 'male' | 'female';
  selectedTests: TestType[];
  results: SingleTestResult[];
  /** Grading per test type, plus 'rsa_fi' for fatigue index */
  grades: Partial<Record<string, 1 | 2 | 3 | 4 | 5>>;
  aerobicScore?: number;     // 0–100
  anaerobicScore?: number;   // 0–100
}

export interface ScheduledWorkout {
  id: string;
  templateId: string;
  date: string;       // YYYY-MM-DD
  name: string;       // snapshot of template name at time of scheduling
  createdAt: number;
}
