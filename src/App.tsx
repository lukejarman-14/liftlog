import { useState, useCallback, useEffect, useRef } from 'react';
import { Battery, Zap, X } from 'lucide-react';
import { useStore } from './hooks/useStore';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/screens/Dashboard';
import { ExerciseLibrary } from './components/screens/ExerciseLibrary';
import { ExerciseDetail } from './components/screens/ExerciseDetail';
import { WorkoutBuilder } from './components/screens/WorkoutBuilder';
import { ActiveWorkout } from './components/screens/ActiveWorkout';
import { History } from './components/screens/History';
import { PlanDetail } from './components/screens/PlanDetail';
import { Onboarding } from './components/screens/Onboarding';
import { Login } from './components/screens/Login';
import { Profile } from './components/screens/Profile';
import { NavState, WorkoutExercise, WorkoutSession, UserProfile, TestSession } from './types';
import { POSITION_TEMPLATES } from './data/positionPlans';
import { TestingBattery } from './components/screens/TestingBattery';
import { sessionToLegacyTest, calcBaselineResults } from './data/testingBattery';
import { LoadCalendar } from './components/screens/LoadCalendar';
import { ProgrammeBuilder } from './components/screens/ProgrammeBuilder';
import { GeneratedProgramme } from './components/screens/GeneratedProgramme';
import { ProgrammeHub } from './components/screens/ProgrammeHub';
import { ResetPassword } from './components/screens/ResetPassword';
import { generateProgramme } from './lib/programmeGenerator';
import { ProgrammeInputs, GeneratedProgramme as GPType } from './types';
import {
  isSupabaseConfigured,
  cloudSignOut,
  cloudSaveData,
  cloudDeleteAccount,
  getExistingSession,
} from './lib/cloudSync';
import { supabase } from './lib/supabase';

// Detect recovery token in URL synchronously (before React mounts).
// Supabase implicit flow appends #access_token=...&type=recovery to the redirectTo URL.
// This lets us bypass the session spinner and auth guards immediately.
function detectRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return hash.includes('type=recovery') || search.includes('type=recovery');
}

export default function App() {
  const store = useStore();
  const [nav, setNav] = useState<NavState>({ screen: 'dashboard' });
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [currentProgramme, setCurrentProgramme] = useState<GPType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // true while we confirm whether a Supabase session exists (skip spinner for recovery URLs)
  const [sessionChecking, setSessionChecking] = useState(isSupabaseConfigured && !detectRecoveryUrl());
  // true when the user has arrived via a password-reset link — bypasses profile/auth guards
  const [isRecoveryMode, setIsRecoveryMode] = useState(detectRecoveryUrl);

  const cloudUserIdRef = useRef<string | null>(null);
  const [showProgrammePrompt, setShowProgrammePrompt] = useState(false);

  // ── One-time migration: ll_ → vf_ storage keys ───────────────────────────
  useEffect(() => {
    const OLD_KEYS = [
      'll_user_profile', 'll_custom_exercises', 'll_templates', 'll_sessions',
      'll_active_plan', 'll_profile_picture', 'll_settings', 'll_baseline',
      'll_match_entries', 'll_performance_entries', 'll_test_sessions',
      'll_generated_programmes', 'll_active_programme_id', 'll_daily_readiness',
      'll_football_intensity',
    ];
    let migrated = false;
    for (const key of OLD_KEYS) {
      const oldVal = localStorage.getItem(key);
      const newKey = key.replace('ll_', 'vf_');
      if (oldVal !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal);
        migrated = true;
      }
      localStorage.removeItem(key);
    }
    if (migrated) window.location.reload();
  }, []);

  // ── Low-readiness volume prompt ────────────────────────────────────────────
  const [pendingWorkout, setPendingWorkout] = useState<{ name: string; items: WorkoutExercise[] } | null>(null);

  // ── On mount: restore existing Supabase session ────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getExistingSession()
      .then(userId => {
        if (userId) {
          cloudUserIdRef.current = userId;
          setIsAuthenticated(true);
        }
      })
      .catch(() => { /* session check failed — continue as unauthenticated */ })
      .finally(() => { setSessionChecking(false); });
  }, []);

  // ── Listen for password recovery event (from reset email link) ────────────
  // Supabase replays the initial auth event to new listeners, so even if the token
  // was processed before this effect runs, we still receive PASSWORD_RECOVERY here.
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user?.id) cloudUserIdRef.current = session.user.id;
        setIsAuthenticated(true);
        setIsRecoveryMode(true);
        setSessionChecking(false);   // clear spinner if still showing
        setNav({ screen: 'reset-password' });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Periodic background sync (every 2 min while authenticated) ────────────
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return;
    const id = setInterval(() => {
      if (cloudUserIdRef.current) cloudSaveData(cloudUserIdRef.current);
    }, 120_000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // ── Save to cloud before page unload ──────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return;
    const handler = () => {
      if (cloudUserIdRef.current) cloudSaveData(cloudUserIdRef.current);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAuthenticated]);

  const navigate = useCallback((next: NavState) => {
    setNav(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);


  const launchWorkout = (name: string, items: WorkoutExercise[]) => {
    const session: WorkoutSession = {
      id: `session-${Date.now()}`,
      name: name || 'Workout',
      exercises: items.map(item => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeight: item.targetWeight,
        restSeconds: item.restSeconds,
        targetRir: item.targetRir,
        blockTitle: item.blockTitle,
        sets: [],
      })),
      startTime: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };
    setActiveSession(session);
    setNav({ screen: 'active-workout' });
  };

  const handleStartWorkout = (name: string, items: WorkoutExercise[]) => {
    const todayReadiness = store.getTodayReadiness();
    if (todayReadiness && todayReadiness.level === 'low') {
      setPendingWorkout({ name, items });
    } else {
      launchWorkout(name, items);
    }
  };

  const handleUpdateSession = (session: WorkoutSession) => setActiveSession(session);

  const handleFinishWorkout = (session: WorkoutSession) => {
    store.saveSession(session);
    setActiveSession(null);
    setNav({ screen: 'dashboard' });
  };

  const getActiveProgramme = () =>
    store.activeProgrammeId
      ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
      : null;

  // Default interval counts — used when no stored count or history exists
  const CONDITIONING_DEFAULTS: Record<string, number> = { 'hiit-run': 8 };

  const handleStartProgrammeSession = (name: string, items: WorkoutExercise[]) => {
    const activeProg = getActiveProgramme();
    const adjustedItems = items.map(item => {
      const exercise = store.getExercise(item.exerciseId);
      if (exercise?.category !== 'Conditioning') return item;
      // 1. Programme override (set by post-workout feedback)
      const stored = activeProg?.conditioningRepCounts?.[item.exerciseId];
      if (stored != null) return { ...item, targetSets: stored };
      // 2. Last session volume for continuity
      const lastEx = store.getLastSession(item.exerciseId, '');
      if (lastEx && lastEx.targetSets > 0) return { ...item, targetSets: lastEx.targetSets };
      // 3. Science-based default (hiit-run always starts at 8)
      const def = CONDITIONING_DEFAULTS[item.exerciseId];
      if (def != null) return { ...item, targetSets: def };
      return item;
    });
    handleStartWorkout(name, adjustedItems);
  };

  const handleConditioningFeedback = (updates: Record<string, number>) => {
    const activeProg = getActiveProgramme();
    if (!activeProg) return;
    const currentCounts = activeProg.conditioningRepCounts ?? {};
    const currentStagnation = activeProg.conditioningStagnation ?? {};
    const newStagnation = { ...currentStagnation };
    for (const [id, newCount] of Object.entries(updates)) {
      const prev = currentCounts[id] ?? CONDITIONING_DEFAULTS[id] ?? newCount;
      newStagnation[id] = newCount > prev ? 0 : (newStagnation[id] ?? 0) + 1;
    }
    store.saveGeneratedProgramme({
      ...activeProg,
      conditioningRepCounts: { ...currentCounts, ...updates },
      conditioningStagnation: newStagnation,
    });
  };

  const handleStartTemplate = (templateId: string, name: string) => {
    const template = POSITION_TEMPLATES.find(t => t.id === templateId);
    if (template) handleStartWorkout(name || template.name, template.exercises);
  };

  const activatePlan = (planId: string) => {
    if (!planId) return;
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
    const startDate = new Date(today);
    if (daysToMonday > 0) startDate.setDate(today.getDate() + daysToMonday);
    store.setActivePlan({ planId, startDate: startDate.toISOString().split('T')[0] });
  };

  const handleOnboardingComplete = (
    profile: UserProfile,
    recommendedPlanId: string,
    userId?: string,
  ) => {
    store.setUserProfile(profile);
    activatePlan(recommendedPlanId);
    if (userId) cloudUserIdRef.current = userId;
    navigate({ screen: 'dashboard' });
    setShowProgrammePrompt(true);
  };

  const handleGenerateProgramme = (inputs: ProgrammeInputs) => {
    const programme = generateProgramme(inputs);
    store.saveGeneratedProgramme(programme);
    // Do NOT auto-activate — user presses "Start Plan" to activate
    setCurrentProgramme(programme);
    navigate({ screen: 'generated-programme' });
  };

  const handleViewProgramme = (programme: GPType) => {
    setCurrentProgramme(programme);
    navigate({ screen: 'generated-programme' });
  };

  const handleBatteryComplete = (session: TestSession) => {
    store.saveTestSession(session);
    const legacyTest = sessionToLegacyTest(session);
    const legacyResults = calcBaselineResults(legacyTest);
    store.saveBaseline(legacyTest, legacyResults);
    navigate({ screen: 'dashboard' });
  };

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured && cloudUserIdRef.current) {
        await cloudSaveData(cloudUserIdRef.current);
        await cloudSignOut();
      }
    } catch {
      // logout proceeds regardless of cloud errors
    } finally {
      cloudUserIdRef.current = null;
      setIsAuthenticated(false);
    }
  };

  // ── Auth guards ────────────────────────────────────────────────────────────

  // Password-reset flow: bypass all auth/profile guards so the reset form is
  // always reachable regardless of local profile state or auth status.
  if (isRecoveryMode || nav.screen === 'reset-password') {
    return (
      <ResetPassword
        onDone={() => {
          setIsRecoveryMode(false);
          navigate({ screen: 'dashboard' });
        }}
      />
    );
  }

  // While checking for Supabase session, show a minimal loading state
  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (!store.userProfile) {
    return (
      <Onboarding
        // If already authenticated (e.g. login succeeded but profile wasn't in cloud),
        // pass the userId so Onboarding skips auth and goes straight to profile setup.
        existingUserId={isAuthenticated ? (cloudUserIdRef.current ?? undefined) : undefined}
        onComplete={(profile, planId, userId) => {
          handleOnboardingComplete(profile, planId, userId);
          setIsAuthenticated(true);
        }}
        onLoginSuccess={(userId) => {
          if (userId) cloudUserIdRef.current = userId;
          setIsAuthenticated(true);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Login
        profile={store.userProfile}
        onLogin={(userId) => {
          if (userId) cloudUserIdRef.current = userId;
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const { screen } = nav;
  const fullScreens = ['testing-battery', 'programme-builder', 'generated-programme'];

  return (
    <div className="min-h-screen bg-gray-50">
      {screen === 'dashboard' && (
        <Dashboard
          sessions={store.sessions}
          activePlan={store.activePlan}
          activeProgramme={store.activeProgrammeId
            ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
            : null}
          profilePicture={store.profilePicture}
          todayReadiness={store.getTodayReadiness()}
          exercises={store.exercises}
          onSaveReadiness={store.saveDailyReadiness}
          onNavigate={navigate}
          onStartWorkout={handleStartTemplate}
          onStartProgrammeSession={handleStartProgrammeSession}
        />
      )}

      {screen === 'exercise-library' && (
        <ExerciseLibrary
          exercises={store.exercises}
          onAddCustom={store.addCustomExercise}
          onDeleteCustom={store.deleteCustomExercise}
          onNavigate={navigate}
        />
      )}

      {screen === 'exercise-detail' && nav.exerciseId && (() => {
        const exercise = store.getExercise(nav.exerciseId);
        if (!exercise) return null;
        return (
          <ExerciseDetail
            exercise={exercise}
            sessions={store.sessions}
            onNavigate={navigate}
            onBack={() => setNav({ screen: 'exercise-library' })}
          />
        );
      })()}

      {screen === 'workout-builder' && (
        <WorkoutBuilder
          exercises={store.exercises}
          templates={store.templates}
          initialTemplateId={nav.templateId}
          onStart={handleStartWorkout}
          onSaveTemplate={store.saveTemplate}
          onDeleteTemplate={store.deleteTemplate}
        />
      )}

      {screen === 'active-workout' && activeSession && (
        <ActiveWorkout
          session={activeSession}
          showTutorials={store.userSettings.showTutorialVideos}
          onUpdateSession={handleUpdateSession}
          onFinish={handleFinishWorkout}
          onConditioningFeedback={handleConditioningFeedback}
          conditioningStagnation={getActiveProgramme()?.conditioningStagnation}
          onDiscard={() => { setActiveSession(null); navigate({ screen: 'dashboard' }); }}
        />
      )}

      {screen === 'history' && (
        <History
          sessions={store.sessions}
          onNavigate={navigate}
          onDeleteSession={store.deleteSession}
        />
      )}

      {screen === 'plans' && store.userProfile && (
        <ProgrammeHub
          userProfile={store.userProfile}
          generatedProgrammes={store.generatedProgrammes}
          activeProgrammeId={store.activeProgrammeId}
          onNavigate={navigate}
          onViewProgramme={handleViewProgramme}
          onDeleteProgramme={store.deleteGeneratedProgramme}
        />
      )}

      {screen === 'plan-detail' && nav.planId && (
        <PlanDetail
          planId={nav.planId}
          activePlan={store.activePlan}
          onSetActivePlan={store.setActivePlan}
          onNavigate={navigate}
          onStartWorkout={handleStartTemplate}
          onBack={() => navigate({ screen: 'plans' })}
        />
      )}

      {screen === 'profile' && store.userProfile && (
        <Profile
          userProfile={store.userProfile}
          profilePicture={store.profilePicture}
          totalSessions={store.sessions.length}
          baseline={store.baseline}
          onSetProfilePicture={store.setProfilePicture}
          onStartBattery={() => navigate({ screen: 'testing-battery' })}
          onResetProfile={async () => {
            // Delete from Supabase first
            if (isSupabaseConfigured) await cloudDeleteAccount();
            // Wipe ALL localStorage for this origin — catches vf_*, ll_* (legacy),
            // Supabase session tokens, and anything else. Must run synchronously
            // before React can re-render and write values back.
            localStorage.clear();
            // Hard reload so the app boots clean from empty storage
            window.location.href = '/';
          }}
          onChangePassword={(newHash) => {
            if (store.userProfile) {
              store.setUserProfile({ ...store.userProfile, passwordHash: newHash });
            }
          }}
          onUpdateProfile={(updates) => {
            if (store.userProfile) {
              store.setUserProfile({ ...store.userProfile, ...updates });
            }
          }}
          onSaveTrainingProfile={(updates) => {
            if (store.userProfile) {
              store.setUserProfile({ ...store.userProfile, ...updates });
              store.setActiveProgrammeId(null);
            }
          }}
          onLogout={handleLogout}
          onBack={() => navigate({ screen: 'dashboard' })}
        />
      )}

      {screen === 'testing-battery' && store.userProfile && (
        <TestingBattery
          position={store.userProfile.position}
          previousSession={store.testSessions.length > 0
            ? store.testSessions[store.testSessions.length - 1]
            : null}
          onComplete={handleBatteryComplete}
          onSkip={() => navigate({ screen: 'dashboard' })}
        />
      )}

      {screen === 'load-calendar' && (
        <LoadCalendar
          onBack={() => navigate({ screen: 'dashboard' })}
          activeProgramme={store.activeProgrammeId
            ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
            : null}
          onUpdateProgramme={(prog) => store.saveGeneratedProgramme(prog)}
        />
      )}

      {screen === 'programme-builder' && store.userProfile && (
        <ProgrammeBuilder
          userProfile={store.userProfile}
          onGenerate={handleGenerateProgramme}
          onBack={() => navigate({ screen: 'plans' })}
        />
      )}

      {screen === 'generated-programme' && (() => {
        const prog = currentProgramme
          ?? (store.activeProgrammeId
            ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
            : null);
        if (!prog) return null;
        return (
          <GeneratedProgramme
            programme={prog}
            isActive={store.activeProgrammeId === prog.id}
            onBack={() => navigate({ screen: 'plans' })}
            onRebuild={() => navigate({ screen: 'programme-builder' })}
            onApply={() => {
              store.setActiveProgrammeId(prog.id);
              setCurrentProgramme(prog);
              navigate({ screen: 'dashboard' });
            }}
            onDeactivate={() => store.setActiveProgrammeId(null)}
            onSaveStrengthSetup={(setup) => {
              const updated = { ...prog, strengthSetup: setup };
              store.saveGeneratedProgramme(updated);
              setCurrentProgramme(updated);
            }}
            onSaveReorder={(weekIdx, newSessions) => {
              const updated = {
                ...prog,
                weeks: prog.weeks.map((w, i) =>
                  i === weekIdx ? { ...w, sessions: newSessions } : w
                ),
              };
              store.saveGeneratedProgramme(updated);
              setCurrentProgramme(updated);
            }}
          />
        );
      })()}

      {!fullScreens.includes(screen) && (
        <Navigation current={screen} onNavigate={s => navigate({ screen: s })} />
      )}

      {/* ── Post-onboarding: build programme prompt ─────────────────────── */}
      {showProgrammePrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-8">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 mx-auto shadow-lg">
              <Zap size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 text-center mb-2">
              Welcome to Vector Football!
            </h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
              Ready to build your personalised training programme? It only takes a minute and uses everything you just told us.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowProgrammePrompt(false);
                  navigate({ screen: 'programme-builder' });
                }}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-md"
              >
                Build My Programme
              </button>
              <button
                onClick={() => setShowProgrammePrompt(false)}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Continue to App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Low-readiness volume prompt ─────────────────────────────────── */}
      {pendingWorkout && (() => {
        const r = store.getTodayReadiness();
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-5">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
              {/* Close button */}
              <div className="flex justify-end mb-1 -mt-1 -mr-1">
                <button
                  onClick={() => {
                    const { name, items } = pendingWorkout;
                    setPendingWorkout(null);
                    launchWorkout(name, items);
                  }}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Battery size={22} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Low Readiness Detected</h3>
                  <p className="text-xs text-amber-600 font-semibold">Score {r?.score.toFixed(1) ?? '—'} / 5 · Low</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-5">
                Your readiness score is low today. Reducing <strong>volume</strong> (fewer sets) lets you train without overloading a tired body — load and reps stay the same.
              </p>

              {/* Preview */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800">
                <p className="font-semibold mb-1">If you reduce volume:</p>
                <p>Each exercise drops by 1 set (minimum 1). Weight, reps, and rest stay unchanged.</p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const reduced = pendingWorkout.items.map(ex => ({
                      ...ex,
                      targetSets: Math.max(1, ex.targetSets - 1),
                    }));
                    setPendingWorkout(null);
                    launchWorkout(pendingWorkout.name, reduced);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
                >
                  Reduce Volume (−1 set each)
                </button>
                <button
                  onClick={() => {
                    const { name, items } = pendingWorkout;
                    setPendingWorkout(null);
                    launchWorkout(name, items);
                  }}
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap size={15} className="text-brand-500" />
                  Keep Full Volume
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
