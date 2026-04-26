import { useLocalStorage } from './useLocalStorage';
import { Exercise, WorkoutTemplate, WorkoutSession, ActivePlan } from '../types';
import { DEFAULT_EXERCISES } from '../data/exercises';

export function useStore() {
  const [customExercises, setCustomExercises] = useLocalStorage<Exercise[]>('ll_custom_exercises', []);
  const [templates, setTemplates] = useLocalStorage<WorkoutTemplate[]>('ll_templates', []);
  const [sessions, setSessions] = useLocalStorage<WorkoutSession[]>('ll_sessions', []);
  const [activePlan, setActivePlan] = useLocalStorage<ActivePlan | null>('ll_active_plan', null);

  const exercises = [...DEFAULT_EXERCISES, ...customExercises];

  const getExercise = (id: string) => exercises.find(e => e.id === id);

  // Exercises
  const addCustomExercise = (ex: Exercise) => {
    setCustomExercises(prev => [...prev, ex]);
  };

  const deleteCustomExercise = (id: string) => {
    setCustomExercises(prev => prev.filter(e => e.id !== id));
  };

  // Templates
  const saveTemplate = (template: WorkoutTemplate) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = template;
        return next;
      }
      return [...prev, template];
    });
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // Sessions
  const saveSession = (session: WorkoutSession) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = session;
        return next;
      }
      return [...prev, session];
    });
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const getSessionsForExercise = (exerciseId: string) =>
    sessions
      .filter(s => s.exercises.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => a.startTime - b.startTime);

  // Returns the most recent completed session (excluding currentSessionId) that contains exerciseId
  const getLastSession = (exerciseId: string, currentSessionId: string) => {
    const past = sessions
      .filter(s => s.id !== currentSessionId && s.endTime != null && s.exercises.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.startTime - a.startTime);
    if (!past.length) return null;
    const session = past[0];
    return session.exercises.find(e => e.exerciseId === exerciseId) ?? null;
  };

  // Returns the single best set ever for an exercise (by weight, then reps)
  const getPB = (exerciseId: string) => {
    let best: { weight: number; reps: number } | null = null;
    for (const session of sessions) {
      const ex = session.exercises.find(e => e.exerciseId === exerciseId);
      if (!ex) continue;
      for (const set of ex.sets) {
        if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
          best = { weight: set.weight, reps: set.reps };
        }
      }
    }
    return best;
  };

  return {
    exercises,
    customExercises,
    templates,
    sessions,
    activePlan,
    setActivePlan,
    getExercise,
    addCustomExercise,
    deleteCustomExercise,
    saveTemplate,
    deleteTemplate,
    saveSession,
    deleteSession,
    getSessionsForExercise,
    getLastSession,
    getPB,
  };
}
