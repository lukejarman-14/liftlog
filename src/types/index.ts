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

export type Screen =
  | 'dashboard'
  | 'exercise-library'
  | 'workout-builder'
  | 'active-workout'
  | 'history'
  | 'exercise-detail';

export interface NavState {
  screen: Screen;
  exerciseId?: string;
  templateId?: string;
  sessionId?: string;
}
