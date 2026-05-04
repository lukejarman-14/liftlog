import { useState, useCallback, useEffect, useRef } from 'react';
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

export default function App() {
  const store = useStore();
  const [nav, setNav] = useState<NavState>({ screen: 'dashboard' });
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [currentProgramme, setCurrentProgramme] = useState<GPType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // While checking for an existing Supabase session, show nothing to avoid flash
  const [sessionChecking, setSessionChecking] = useState(isSupabaseConfigured);

  const cloudUserIdRef = useRef<string | null>(null);

  // ── On mount: restore existing Supabase session ────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getExistingSession().then(userId => {
      if (userId) {
        cloudUserIdRef.current = userId;
        setIsAuthenticated(true);
      }
      setSessionChecking(false);
    });
  }, []);

  // ── Listen for password recovery event (from reset email link) ────────────
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user?.id) cloudUserIdRef.current = session.user.id;
        setIsAuthenticated(true);
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

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [nav.screen]);

  const handleStartWorkout = (name: string, items: WorkoutExercise[]) => {
    const session: WorkoutSession = {
      id: `session-${Date.now()}`,
      name: name || 'Workout',
      exercises: items.map(item => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeight: item.targetWeight,
        restSeconds: item.restSeconds,
        sets: [],
      })),
      startTime: Date.now(),
      date: new Date().toISOString().split('T')[0],
    };
    setActiveSession(session);
    setNav({ screen: 'active-workout' });
  };

  const handleUpdateSession = (session: WorkoutSession) => setActiveSession(session);

  const handleFinishWorkout = (session: WorkoutSession) => {
    store.saveSession(session);
    setActiveSession(null);
    setNav({ screen: 'dashboard' });
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
  };

  const handleGenerateProgramme = (inputs: ProgrammeInputs) => {
    const programme = generateProgramme(inputs);
    store.saveGeneratedProgramme(programme);
    store.setActiveProgrammeId(programme.id);
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
    // Save current data to cloud before logging out
    if (isSupabaseConfigured && cloudUserIdRef.current) {
      await cloudSaveData(cloudUserIdRef.current);
      await cloudSignOut();
    }
    cloudUserIdRef.current = null;
    setIsAuthenticated(false);
  };

  // ── Auth guards ────────────────────────────────────────────────────────────

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
  const fullScreens = ['testing-battery', 'programme-builder', 'generated-programme', 'reset-password'];

  return (
    <div className="min-h-screen bg-gray-50">
      {screen === 'dashboard' && (
        <Dashboard
          sessions={store.sessions}
          templates={store.templates}
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
          onStartProgrammeSession={handleStartWorkout}
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
            showTutorials={store.userSettings.showTutorialVideos}
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
          onNavigate={navigate}
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
            // Delete from Supabase first, then clear local data
            if (isSupabaseConfigured) await cloudDeleteAccount();
            store.clearAll();
            cloudUserIdRef.current = null;
            setIsAuthenticated(false);
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
          onNavigate={navigate}
          onBack={() => navigate({ screen: 'dashboard' })}
          activeProgramme={store.activeProgrammeId
            ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
            : null}
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
            onBack={() => navigate({ screen: 'dashboard' })}
            onRebuild={() => navigate({ screen: 'programme-builder' })}
            onApply={() => {
              store.setActiveProgrammeId(prog.id);
              setCurrentProgramme(prog);
              navigate({ screen: 'dashboard' });
            }}
            onDeactivate={() => store.setActiveProgrammeId(null)}
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

      {screen === 'reset-password' && (
        <ResetPassword onDone={() => navigate({ screen: 'dashboard' })} />
      )}

      {!fullScreens.includes(screen) && (
        <Navigation current={screen} onNavigate={s => navigate({ screen: s })} />
      )}
    </div>
  );
}
