import { useLocalStorage } from './useLocalStorage';
import {
  Exercise, WorkoutTemplate, WorkoutSession, ActivePlan,
  UserProfile, UserSettings, DEFAULT_SETTINGS,
  BaselineTest, BaselineResults,
  MatchEntry, TestSession, GeneratedProgramme, DailyReadiness, ScheduledWorkout,
  WeightEntry,
} from '../types';
import { DEFAULT_EXERCISES } from '../data/exercises';

export interface BaselineData {
  test: BaselineTest;
  results: BaselineResults;
  savedAt: number;
}

export function useStore() {
  const [customExercises, setCustomExercises] = useLocalStorage<Exercise[]>('vf_custom_exercises', []);
  const [templates, setTemplates] = useLocalStorage<WorkoutTemplate[]>('vf_templates', []);
  const [sessions, setSessions] = useLocalStorage<WorkoutSession[]>('vf_sessions', []);
  const [activePlan, setActivePlan] = useLocalStorage<ActivePlan | null>('vf_active_plan', null);
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile | null>('vf_user_profile', null);
  const [profilePicture, setProfilePicture] = useLocalStorage<string | null>('vf_profile_picture', null);
  const [userSettings, setUserSettings] = useLocalStorage<UserSettings>('vf_settings', DEFAULT_SETTINGS);
  const [baseline, setBaselineRaw] = useLocalStorage<BaselineData | null>('vf_baseline', null);
  const [matchEntries, setMatchEntries] = useLocalStorage<MatchEntry[]>('vf_match_entries', []);
  const [testSessions, setTestSessions] = useLocalStorage<TestSession[]>('vf_test_sessions', []);
  const [generatedProgrammes, setGeneratedProgrammes] = useLocalStorage<GeneratedProgramme[]>('vf_generated_programmes', []);
  const [activeProgrammeId, setActiveProgrammeId] = useLocalStorage<string | null>('vf_active_programme_id', null);
  const [dailyReadinessLog, setDailyReadinessLog] = useLocalStorage<DailyReadiness[]>('vf_daily_readiness', []);
  const [footballIntensityLog, setFootballIntensityLog] = useLocalStorage<Record<string, number>>('vf_football_intensity', {});
  const [scheduledWorkouts, setScheduledWorkouts] = useLocalStorage<ScheduledWorkout[]>('vf_scheduled_workouts', []);
  const [weightLog, setWeightLog] = useLocalStorage<WeightEntry[]>('vf_weight_log', []);

  const updateSettings = (partial: Partial<UserSettings>) =>
    setUserSettings(prev => ({ ...prev, ...partial }));

  const saveBaseline = (test: BaselineTest, results: BaselineResults) =>
    setBaselineRaw({ test, results, savedAt: Date.now() });

  // Match entries
  const saveMatchEntry = (entry: MatchEntry) =>
    setMatchEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry];
    });

  const deleteMatchEntry = (id: string) =>
    setMatchEntries(prev => prev.filter(e => e.id !== id));

  // Test sessions (historical — never overwritten)
  const saveTestSession = (session: TestSession) =>
    setTestSessions(prev => {
      const idx = prev.findIndex(s => s.id === session.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = session; return next; }
      return [...prev, session];
    });

  // Generated programmes — store up to 10 most recent
  const saveGeneratedProgramme = (programme: GeneratedProgramme) =>
    setGeneratedProgrammes(prev => {
      const filtered = prev.filter(p => p.id !== programme.id);
      return [programme, ...filtered].slice(0, 10);
    });

  const deleteGeneratedProgramme = (id: string) => {
    setGeneratedProgrammes(prev => prev.filter(p => p.id !== id));
    // If the deleted programme was active, clear it
    setActiveProgrammeId(prev => (prev === id ? null : prev));
  };

  // Daily readiness
  const saveDailyReadiness = (entry: DailyReadiness) =>
    setDailyReadinessLog(prev => {
      const filtered = prev.filter(r => r.date !== entry.date);
      return [entry, ...filtered].slice(0, 90); // keep 90 days
    });

  const getTodayReadiness = (): DailyReadiness | null => {
    const today = new Date().toISOString().split('T')[0];
    return dailyReadinessLog.find(r => r.date === today) ?? null;
  };

  // Football session intensity
  const saveFootballIntensity = (date: string, intensity: number) =>
    setFootballIntensityLog(prev => ({ ...prev, [date]: intensity }));

  // Scheduled workouts (template workouts placed on calendar dates)
  const saveScheduledWorkout = (entry: ScheduledWorkout) =>
    setScheduledWorkouts(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry];
    });

  const deleteScheduledWorkout = (id: string) =>
    setScheduledWorkouts(prev => prev.filter(e => e.id !== id));

  // Weight log
  const saveWeightEntry = (entry: WeightEntry) =>
    setWeightLog(prev => {
      const filtered = prev.filter(e => e.date !== entry.date);
      return [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365);
    });

  const deleteWeightEntry = (date: string) =>
    setWeightLog(prev => prev.filter(e => e.date !== date));

  /** Returns consecutive 'low' readiness days ending at (but not including) today */
  const getConsecutiveLowReadinessDays = (): number => {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (dateStr === today) continue;
      const entry = dailyReadinessLog.find(r => r.date === dateStr);
      if (entry?.level === 'low') { count++; } else { break; }
    }
    return count;
  };

  /** Returns days since the most recent test session, or null if never tested */
  const getDaysSinceLastTest = (): number | null => {
    if (!testSessions.length) return null;
    const latest = testSessions.reduce((a, b) => a.completedAt > b.completedAt ? a : b);
    return Math.floor((Date.now() - latest.completedAt) / (1000 * 60 * 60 * 24));
  };

  /** Returns the date of the most recent match/team_training entry (within 3 days)
   *  that has no intensity rating yet, or null if nothing pending. */
  const getPendingIntensityCheck = (): string | null => {
    const today = new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasEntry = matchEntries.some(e => e.date === dateStr && (e.type === 'match' || e.type === 'team_training'));
      if (hasEntry && footballIntensityLog[dateStr] == null) return dateStr;
    }
    return null;
  };

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
      .filter(s => s.id !== currentSessionId && s.exercises.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => b.startTime - a.startTime);
    if (!past.length) return null;
    const session = past[0];
    return session.exercises.find(e => e.exerciseId === exerciseId) ?? null;
  };

  // Returns the single best set ever for an exercise.
  // For reps-only exercises (measureType 'reps') ranks by reps; otherwise by weight then reps.
  const getPB = (exerciseId: string, measureType?: string) => {
    let best: { weight: number; reps: number } | null = null;
    for (const session of sessions) {
      const ex = session.exercises.find(e => e.exerciseId === exerciseId);
      if (!ex) continue;
      for (const set of ex.sets) {
        if (measureType === 'reps') {
          if (!best || set.reps > best.reps) best = { weight: set.weight, reps: set.reps };
        } else {
          if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
            best = { weight: set.weight, reps: set.reps };
          }
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
    userProfile,
    setUserProfile,
    profilePicture,
    setProfilePicture,
    userSettings,
    updateSettings,
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
    baseline,
    saveBaseline,
    matchEntries,
    saveMatchEntry,
    deleteMatchEntry,
    testSessions,
    saveTestSession,
    generatedProgrammes,
    saveGeneratedProgramme,
    deleteGeneratedProgramme,
    activeProgrammeId,
    setActiveProgrammeId,
    dailyReadinessLog,
    saveDailyReadiness,
    getTodayReadiness,
    footballIntensityLog,
    saveFootballIntensity,
    getPendingIntensityCheck,
    scheduledWorkouts,
    saveScheduledWorkout,
    deleteScheduledWorkout,
    weightLog,
    saveWeightEntry,
    deleteWeightEntry,
    getConsecutiveLowReadinessDays,
    getDaysSinceLastTest,
    clearAll: () => {
      // Remove localStorage keys first so useLocalStorage hooks re-init to defaults
      const VF_KEYS = [
        'vf_user_profile', 'vf_custom_exercises', 'vf_templates', 'vf_sessions',
        'vf_active_plan', 'vf_profile_picture', 'vf_settings', 'vf_baseline',
        'vf_match_entries', 'vf_test_sessions',
        'vf_generated_programmes', 'vf_active_programme_id', 'vf_daily_readiness',
        'vf_football_intensity', 'vf_scheduled_workouts', 'vf_weight_log',
      ];
      VF_KEYS.forEach(k => localStorage.removeItem(k));
      // Reset React state
      setUserProfile(null);
      setCustomExercises([]);
      setTemplates([]);
      setSessions([]);
      setActivePlan(null);
      setProfilePicture(null);
      setUserSettings(DEFAULT_SETTINGS);
      setBaselineRaw(null);
      setMatchEntries([]);
      setTestSessions([]);
      setGeneratedProgrammes([]);
      setActiveProgrammeId(null);
      setDailyReadinessLog([]);
      setFootballIntensityLog({});
      setScheduledWorkouts([]);
      setWeightLog([]);
    },
  };
}
