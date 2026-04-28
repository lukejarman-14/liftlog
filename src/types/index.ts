export type ExerciseCategory =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio'
  | 'Full Body'
  | 'Olympic'
  | 'Isometric'
  | 'Plyometrics'
  | 'Speed & Agility'
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

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultRestSeconds: number;
  muscleGroups: string[];
  measureType?: MeasureType;   // defaults to 'strength' when absent
  unit?: string;               // display label override e.g. 's', 'm', 'cm', 'N/kg'
  isCustom?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
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
}

export interface SessionExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
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

// ── User Settings ─────────────────────────────────────────────────────────

export interface UserSettings {
  showTutorialVideos: boolean;   // show demo videos & how-to guides in workouts + exercise detail
  // add more preferences here over time
}

export const DEFAULT_SETTINGS: UserSettings = {
  showTutorialVideos: true,
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
  | 'testing-battery';

export interface NavState {
  screen: Screen;
  exerciseId?: string;
  templateId?: string;
  sessionId?: string;
  planId?: string;
}
