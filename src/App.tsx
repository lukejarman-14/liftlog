import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { Battery, Zap, X } from 'lucide-react';
import { useStore } from './hooks/useStore';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/screens/Dashboard';
import { NavState, WorkoutExercise, WorkoutSession, UserProfile, TestSession, ProgrammeSession } from './types';
import { POSITION_TEMPLATES } from './data/positionPlans';
import { sessionToLegacyTest, calcBaselineResults } from './data/testingBattery';
import { generateProgramme, buildTestEmphasis } from './lib/programmeGenerator';
import { sessionToWorkoutExercises, getProgrammeWeekIndex } from './lib/sessionUtils';
import { ProgrammeInputs, GeneratedProgramme as GPType } from './types';
import { usePremium } from './hooks/usePremium';
import { rcConfigure } from './lib/revenueCat';
import { createStripeCheckout } from './lib/stripeCheckout';
import { Capacitor } from '@capacitor/core';
import {
  isSupabaseConfigured,
  cloudSignOut,
  cloudSaveData,
  cloudLoadData,
  cloudDeleteAccount,
  getExistingSession,
} from './lib/cloudSync';
import { supabase } from './lib/supabase';
import { identifyUser, resetAnalyticsUser, trackEvent } from './lib/analytics';
import { scheduleTrainingReminders, cancelAllTrainingReminders, requestNotificationPermission, scheduleDailyReminder } from './lib/notifications';

const APP_STORE_URL = 'https://apps.apple.com/gb/app/vector-football/id6772522502?action=write-review';
const MS_PER_DAY = 86_400_000;
const TRIAL_PROMPT_DELAY_MS = 2_000;
const NOTIF_PROMPT_DELAY_MS = 1_200;
const REFERRAL_REDIRECT_DELAY_MS = 1_500;
// Default interval counts — used when no stored count or history exists for an exercise
const CONDITIONING_DEFAULTS: Record<string, number> = { 'hiit-run': 8 };

const ExerciseLibrary    = lazy(() => import('./components/screens/ExerciseLibrary').then(m => ({ default: m.ExerciseLibrary })));
const ExerciseDetail     = lazy(() => import('./components/screens/ExerciseDetail').then(m => ({ default: m.ExerciseDetail })));
const WorkoutBuilder     = lazy(() => import('./components/screens/WorkoutBuilder').then(m => ({ default: m.WorkoutBuilder })));
const ActiveWorkout      = lazy(() => import('./components/screens/ActiveWorkout').then(m => ({ default: m.ActiveWorkout })));
const History            = lazy(() => import('./components/screens/History').then(m => ({ default: m.History })));
const PlanDetail         = lazy(() => import('./components/screens/PlanDetail').then(m => ({ default: m.PlanDetail })));
const Onboarding         = lazy(() => import('./components/screens/Onboarding').then(m => ({ default: m.Onboarding })));
const Login              = lazy(() => import('./components/screens/Login').then(m => ({ default: m.Login })));
const Profile            = lazy(() => import('./components/screens/Profile').then(m => ({ default: m.Profile })));
const TestingBattery     = lazy(() => import('./components/screens/TestingBattery').then(m => ({ default: m.TestingBattery })));
const LoadCalendar       = lazy(() => import('./components/screens/LoadCalendar').then(m => ({ default: m.LoadCalendar })));
const ProgrammeBuilder   = lazy(() => import('./components/screens/ProgrammeBuilder').then(m => ({ default: m.ProgrammeBuilder })));
import { GeneratedProgramme, StrengthSetupModal } from './components/screens/GeneratedProgramme';
const ProgrammeHub       = lazy(() => import('./components/screens/ProgrammeHub').then(m => ({ default: m.ProgrammeHub })));
const ResetPassword      = lazy(() => import('./components/screens/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Paywall            = lazy(() => import('./components/screens/Paywall').then(m => ({ default: m.Paywall })));

// check for password reset link on both implicit (#type=recovery) and PKCE (?code=) flows
function detectRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    sessionStorage.getItem('vf_auth_redirect') === '1' ||
    sessionStorage.getItem('vf_recovery_mode') === '1'
  );
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
  const [showGlobalStrengthSetup, setShowGlobalStrengthSetup] = useState(false);
  const [pendingReTestSession, setPendingReTestSession] = useState<TestSession | null>(null);
  const [myReferralCode, setMyReferralCode] = useState<string | undefined>();
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showProgrammeComplete, setShowProgrammeComplete] = useState(false);

  const premium = usePremium();
  const [paywallFeatureLabel, setPaywallFeatureLabel] = useState<string | undefined>();
  const [showTrialPrompt, setShowTrialPrompt] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifPendingProgramme, setNotifPendingProgramme] = useState<GPType | null>(null);

  // Test-grades confirmation popup — shown when user generates a programme and test results exist
  const [testGradesInputs, setTestGradesInputs] = useState<ProgrammeInputs | null>(null);
  const [pendingTestGrades, setPendingTestGrades] = useState<Record<string, 1|2|3|4|5> | null>(null);

  const [pendingWorkout, setPendingWorkout] = useState<{ name: string; items: WorkoutExercise[] } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getExistingSession()
      .then(async userId => {
        if (userId) {
          cloudUserIdRef.current = userId;
          setIsAuthenticated(true);
          identifyUser(userId);
          const isAuthRedirect = sessionStorage.getItem('vf_auth_redirect') === '1';
          sessionStorage.removeItem('vf_auth_redirect');
          if (!sessionStorage.getItem('vf_boot_synced') && !isAuthRedirect) {
            sessionStorage.setItem('vf_boot_synced', '1');
            await cloudLoadData(userId);
          }
          await rcConfigure(userId);
          await premium.syncFromRC();

          const today = new Date().toISOString().split('T')[0];
          const lastShown = localStorage.getItem('vf_trial_prompt_shown');
          if (lastShown !== today) {
            setTimeout(() => {
              // Re-check premium status at fire time — RC sync may have updated it
              const fresh = premium.refresh();
              if (!fresh.isPremium) setShowTrialPrompt(true);
            }, TRIAL_PROMPT_DELAY_MS);
          }
          const code = await premium.getOrCreateReferralCode(userId);
          setMyReferralCode(code);
          await premium.claimReferralRewardsForUser(userId);

          const params = new URLSearchParams(window.location.search);
          if (params.get('stripe_success') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
            // Grant premium immediately from the plan stored before Stripe redirect,
            // so the user doesn't have to wait for the webhook to fire.
            const stripePlan = (sessionStorage.getItem('vf_stripe_plan') ?? 'monthly') as 'monthly' | 'yearly' | 'lifetime';
            sessionStorage.removeItem('vf_stripe_plan');
            premium.setPremium(stripePlan);
            // Also reload from cloud in the background to pick up webhook data
            cloudLoadData(userId).then(() => premium.refresh());
            navigate({ screen: 'programme-builder' });
          } else if (params.get('stripe_cancel') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      })
      .catch(() => { /* session check failed — continue as unauthenticated */ })
      .finally(() => { setSessionChecking(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Set flag immediately so the boot useEffect skips its page reload
        sessionStorage.setItem('vf_recovery_mode', '1');
        if (session?.user?.id) cloudUserIdRef.current = session.user.id;
        setIsAuthenticated(true);
        setIsRecoveryMode(true);
        setSessionChecking(false);
        setNav({ screen: 'reset-password' });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return;
    // Save immediately on first auth so any data present before the timer fires is persisted
    if (cloudUserIdRef.current) cloudSaveData(cloudUserIdRef.current);
    const id = setInterval(() => {
      if (cloudUserIdRef.current) cloudSaveData(cloudUserIdRef.current);
    }, 120_000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  useEffect(() => {
    if (nav.screen !== 'dashboard') return;
    const prog = getActiveProgramme();
    if (!prog) return;
    const startMs = prog.programmeStartDate
      ? new Date(prog.programmeStartDate + 'T12:00:00').getTime()
      : prog.createdAt;
    const weeksSince = Math.floor((Date.now() - startMs) / (7 * MS_PER_DAY));
    if (weeksSince >= prog.durationWeeks && !showProgrammeComplete) {
      const key = `vf_prog_complete_${prog.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setShowProgrammeComplete(true);
      }
    }
  }, [nav.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { reminderEnabled, reminderHour, reminderMinute } = store.userSettings;
    const activeProg = store.activeProgrammeId
      ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
      : null;
    if (reminderEnabled && activeProg) {
      scheduleTrainingReminders(activeProg, reminderHour, reminderMinute);
    } else if (!reminderEnabled) {
      cancelAllTrainingReminders();
    }
  }, [
    store.userSettings.reminderEnabled,
    store.userSettings.reminderHour,
    store.userSettings.reminderMinute,
    store.activeProgrammeId,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return;
    const save = () => {
      if (cloudUserIdRef.current) cloudSaveData(cloudUserIdRef.current);
    };
    // beforeunload covers web/desktop; visibilitychange covers iOS WebView
    // (beforeunload does not fire reliably when the OS suspends the app)
    const onVisibility = () => { if (document.hidden) save(); };
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated]);

  /** Fire-and-forget immediate cloud save — used after key mutations so data
   *  reaches Supabase without waiting for the 2-minute interval. */
  const immediateSave = useCallback(() => {
    if (isSupabaseConfigured && cloudUserIdRef.current) {
      cloudSaveData(cloudUserIdRef.current);
    }
  }, []);

  const navigate = useCallback((next: NavState) => {
    setNav(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  /** Navigate to a gated screen — show paywall if no access. */
  const navigateGated = useCallback((gatedNav: NavState, featureLabel: string) => {
    if (premium.hasAccess) {
      navigate(gatedNav);
    } else {
      setPaywallFeatureLabel(featureLabel);
      navigate({ screen: 'paywall' });
    }
  }, [premium.hasAccess, navigate]);


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
        displayName: item.displayName,
        coachingCue: item.coachingCue,
        hasPrimingSingles: item.hasPrimingSingles,
        isPerSide: item.isPerSide,
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
    const level = todayReadiness?.level;
    if (level === 'low' || level === 'elite') {
      // Show a choice modal — low offers volume reduction, elite offers bonus sets
      setPendingWorkout({ name, items });
    } else if (level === 'moderate') {
      // Auto-apply a moderate intensity note to every exercise coaching cue and launch directly
      const moderateNote = '−10% load · quality focus';
      const noted = items.map(ex => ({
        ...ex,
        coachingCue: ex.coachingCue
          ? `${ex.coachingCue} · ${moderateNote}`
          : moderateNote,
      }));
      launchWorkout(name, noted);
    } else {
      launchWorkout(name, items);
    }
  };

  const handleUpdateSession = (session: WorkoutSession) => setActiveSession(session);

  const handleFinishWorkout = (session: WorkoutSession) => {
    store.saveSession(session);
    immediateSave();
    setActiveSession(null);
    setNav({ screen: 'dashboard' });
    const durationMins = session.endTime ? Math.round((session.endTime - session.startTime) / 60000) : 0;
    const totalSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => !s.isPriming).length, 0);
    trackEvent('workout_completed', {
      session_name: session.name,
      exercise_count: session.exercises.length,
      set_count: totalSets,
      duration_mins: durationMins,
      total_sessions: store.sessions.length + 1,
    });
    const count = store.sessions.length + 1;
    if ([5, 15, 30].includes(count)) {
      const lastReview = localStorage.getItem('vf_review_prompted');
      const daysSince = lastReview ? (Date.now() - Number(lastReview)) / MS_PER_DAY : Infinity;
      if (daysSince > 30) setShowReviewPrompt(true);
    }
  };

  const getActiveProgramme = () =>
    store.activeProgrammeId
      ? store.generatedProgrammes.find(p => p.id === store.activeProgrammeId) ?? null
      : null;

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

  const handleStartTodayProgrammeSession = (session: ProgrammeSession) => {
    const activeProg = getActiveProgramme();
    if (!activeProg) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const updated = {
      ...activeProg,
      programmeStartDate: todayStr,
      sessionOverrides: {
        ...(activeProg.sessionOverrides ?? {}),
        '0-0': todayStr,
      },
    };
    store.saveGeneratedProgramme(updated);
    const items = sessionToWorkoutExercises(session, store.exercises, {
      strengthSetup: updated.strengthSetup,
      weekNumber: getProgrammeWeekIndex(updated) + 1,
      totalWeeks: updated.durationWeeks,
    });
    handleStartProgrammeSession(`Week 1 · ${session.dayOfWeek}`, items);
  };

  const handleConditioningFeedback = (updates: Record<string, number>) => {
    const activeProg = getActiveProgramme();
    if (!activeProg) return;
    const currentCounts = activeProg.conditioningRepCounts ?? {};
    const currentStagnation = activeProg.conditioningStagnation ?? {};
    const newStagnation = { ...currentStagnation };
    for (const [id, newCount] of Object.entries(updates)) {
      const prev = currentCounts[id] ?? CONDITIONING_DEFAULTS[id];
      if (prev === undefined) {
        newStagnation[id] = 0;
      } else {
        newStagnation[id] = newCount > prev ? 0 : (newStagnation[id] ?? 0) + 1;
      }
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
    // Start from today — no waiting for next Monday, no missed sessions
    const today = new Date();
    store.setActivePlan({ planId, startDate: today.toISOString().split('T')[0] });
  };

  const handleOnboardingComplete = (
    profile: UserProfile,
    recommendedPlanId: string,
    userId?: string,
  ) => {
    store.setUserProfile(profile);
    activatePlan(recommendedPlanId);
    if (userId) cloudUserIdRef.current = userId;
    // Reset any stale premium/trial state from a previous session so the paywall
    // always shows correctly for a new account. On native iOS, syncFromRC() will
    // restore any real purchase at next boot.
    premium.resetForNewUser();
    // Show paywall immediately for new users — if they dismiss it, drop to dashboard with welcome prompt
    setPaywallFeatureLabel(undefined);
    navigate({ screen: 'paywall' });
  };

  const doGenerateProgramme = (resolvedInputs: ProgrammeInputs) => {
    const programme = generateProgramme(resolvedInputs);
    const todayStr = new Date().toISOString().split('T')[0];
    const finalProgramme = {
      ...programme,
      programmeStartDate: todayStr,
      ...(resolvedInputs.lifts?.length ? { strengthSetup: { lifts: resolvedInputs.lifts, configuredAt: Date.now() } } : {}),
    };
    store.saveGeneratedProgramme(finalProgramme);
    setCurrentProgramme(finalProgramme);
    trackEvent('programme_generated', {
      position: resolvedInputs.position,
      duration_weeks: finalProgramme.durationWeeks,
      gym_access: resolvedInputs.gymAccess,
      off_season: resolvedInputs.offSeason,
      has_strength_setup: !!resolvedInputs.lifts?.length,
      used_test_grades: !!resolvedInputs.testGrades,
    });
    navigate({ screen: 'generated-programme' });
    if (!store.userSettings.reminderEnabled && !localStorage.getItem('vf_notif_prompted')) {
      setTimeout(() => { setNotifPendingProgramme(finalProgramme); setShowNotifPrompt(true); }, NOTIF_PROMPT_DELAY_MS);
    }
  };

  const handleGenerateProgramme = (inputs: ProgrammeInputs) => {
    // Check for latest test grades — show a popup to let user apply or dismiss them
    const latestTest = store.testSessions.length > 0
      ? store.testSessions.reduce((a, b) => a.completedAt > b.completedAt ? a : b)
      : null;
    if (latestTest?.grades && Object.keys(latestTest.grades).length > 0) {
      setTestGradesInputs(inputs);
      setPendingTestGrades(latestTest.grades as Record<string, 1|2|3|4|5>);
      return; // wait for user confirmation
    }
    doGenerateProgramme(inputs);
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
    trackEvent('test_completed', {
      tests: session.selectedTests,
      aerobic_score: session.aerobicScore,
      anaerobic_score: session.anaerobicScore,
      test_count: store.testSessions.length + 1,
    });
    // Prompt review after first test
    if (store.testSessions.length === 0) setShowReviewPrompt(true);
    // If there's an active generated programme, offer to apply new grades to it
    if (currentProgramme && store.activeProgrammeId === currentProgramme.id) {
      setPendingReTestSession(session);
    } else {
      navigate({ screen: 'dashboard' });
    }
  };

  const applyRetestToProgramme = (testSession: TestSession) => {
    if (!currentProgramme) return;
    const updatedInputs: ProgrammeInputs = { ...currentProgramme.inputs, testGrades: testSession.grades };
    const rebuilt = generateProgramme(updatedInputs);
    // Preserve the original ID, start date, and strength setup so existing sessions aren't orphaned
    const merged: GPType = {
      ...rebuilt,
      id: currentProgramme.id,
      createdAt: currentProgramme.createdAt,
      programmeStartDate: currentProgramme.programmeStartDate,
      strengthSetup: currentProgramme.strengthSetup,
    };
    store.saveGeneratedProgramme(merged);
    setCurrentProgramme(merged);
    setPendingReTestSession(null);
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
      resetAnalyticsUser();
      cloudUserIdRef.current = null;
      setIsAuthenticated(false);
    }
  };


  // Password-reset flow: bypass all auth/profile guards so the reset form is
  // always reachable regardless of local profile state or auth status.
  if (isRecoveryMode || nav.screen === 'reset-password') {
    return (
      <ResetPassword
        onDone={() => {
          sessionStorage.removeItem('vf_recovery_mode');
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
          if (userId) identifyUser(userId, { name: profile.firstName, position: profile.position });
          handleOnboardingComplete(profile, planId, userId);
          setIsAuthenticated(true);
        }}
        onLoginSuccess={(userId) => {
          if (userId) {
            cloudUserIdRef.current = userId;
            identifyUser(userId);
            rcConfigure(userId).then(() => premium.syncFromRC()).catch(() => {});
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <Login
          profile={store.userProfile}
          onLogin={(userId) => {
            if (userId) {
              cloudUserIdRef.current = userId;
              identifyUser(userId);
              rcConfigure(userId).then(() => premium.syncFromRC()).catch(() => {});
            }
            setIsAuthenticated(true);
          }}
          onStartOver={() => {
            store.clearAll();
            resetAnalyticsUser();
            cloudUserIdRef.current = null;
          }}
        />
      </Suspense>
    );
  }

  const { screen } = nav;
  const fullScreens = ['testing-battery', 'programme-builder', 'generated-programme', 'paywall'];
  const screenFallback = <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Suspense fallback={screenFallback}>
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
          onSaveReadiness={(r) => {
            store.saveDailyReadiness(r);
            trackEvent('readiness_logged', { level: r.level, score: r.score });
          }}
          onNavigate={(nav) => {
            if (nav.screen === 'programme-builder') {
              navigateGated(nav, 'Programme Builder');
            } else {
              navigate(nav);
            }
          }}
          onStartWorkout={handleStartTemplate}
          onStartProgrammeSession={handleStartProgrammeSession}
          onStartTodayProgrammeSession={handleStartTodayProgrammeSession}
          onOpenStrengthSetup={() => { setShowGlobalStrengthSetup(true); trackEvent('strength_setup_opened'); }}
          onSkipSession={(weekIdx, sessionIdx, reason) => {
            const prog = getActiveProgramme();
            if (!prog) return;
            const key = `${weekIdx}-${sessionIdx}`;
            store.saveGeneratedProgramme({
              ...prog,
              skippedSessions: { ...(prog.skippedSessions ?? {}), [key]: { reason, skippedAt: Date.now() } },
            });
            trackEvent('session_skipped', { reason, week: weekIdx + 1 });
          }}
          onRescheduleSession={(weekIdx, sessionIdx, newDate) => {
            const prog = getActiveProgramme();
            if (!prog) return;
            const key = `${weekIdx}-${sessionIdx}`;
            // Remove from skipped if it was there, add override date
            const skipped = { ...(prog.skippedSessions ?? {}) };
            delete skipped[key];
            store.saveGeneratedProgramme({
              ...prog,
              skippedSessions: skipped,
              sessionOverrides: { ...(prog.sessionOverrides ?? {}), [key]: newDate },
            });
            trackEvent('session_rescheduled', { week: weekIdx + 1, new_date: newDate });
          }}
          referralCode={myReferralCode}
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
          onSaveTemplate={(t) => { store.saveTemplate(t); immediateSave(); }}
          onDeleteTemplate={(id) => { store.deleteTemplate(id); immediateSave(); }}
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
          strengthSetup={getActiveProgramme()?.strengthSetup ?? null}
          onUpdateStrengthSetup={(setup) => {
            const prog = getActiveProgramme();
            if (!prog) return;
            const updated = { ...prog, strengthSetup: setup };
            store.saveGeneratedProgramme(updated);
            setCurrentProgramme(updated);
          }}
          onDiscard={() => { setActiveSession(null); navigate({ screen: 'dashboard' }); }}
        />
      )}

      {screen === 'history' && (
        <History
          sessions={store.sessions}
          onNavigate={navigate}
          onDeleteSession={store.deleteSession}
          isPremium={premium.hasAccess}
          onUpgrade={(label) => navigateGated({ screen: 'paywall' }, label)}
        />
      )}

      {screen === 'plans' && store.userProfile && (
        <ProgrammeHub
          userProfile={store.userProfile}
          generatedProgrammes={store.generatedProgrammes}
          activeProgrammeId={store.activeProgrammeId}
          onNavigate={(nav) => {
            if (nav.screen === 'programme-builder') {
              navigateGated(nav, 'Programme Builder');
            } else {
              navigate(nav);
            }
          }}
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
          sessions={store.sessions}
          testSessionCount={store.testSessions.length}
          hasImprovedTest={(() => {
            const tests = [...store.testSessions].sort((a, b) => a.completedAt - b.completedAt);
            if (tests.length < 2) return false;
            const first = tests[0]; const last = tests[tests.length - 1];
            // Check if any test type improved from first to last session
            return last.results.some(r => {
              const f = first.results.find(x => x.type === r.type && !x.skipped);
              if (!f || r.skipped) return false;
              const lowerIsBetter = r.type === '10m' || r.type === '30m' || r.type === 'rsa';
              return lowerIsBetter ? r.best < f.best : r.best > f.best;
            });
          })()}
          programmesBuilt={store.generatedProgrammes.length}
          programmesCompleted={store.generatedProgrammes.filter(p =>
            !!localStorage.getItem(`vf_prog_complete_${p.id}`)
          ).length}
          baseline={store.baseline}
          referralCode={myReferralCode}
          onSetProfilePicture={store.setProfilePicture}
          onStartBattery={() => navigate({ screen: 'testing-battery' })}
          onResetProfile={async () => {
            if (isSupabaseConfigured) {
              try {
                await cloudDeleteAccount();
              } catch {
                // Cloud deletion failed — still wipe local data so the user isn't stuck
              }
            }
            localStorage.clear();
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
          weightLog={store.weightLog}
          onSaveWeight={store.saveWeightEntry}
          onDeleteWeight={store.deleteWeightEntry}
          settings={store.userSettings}
          onUpdateSettings={store.updateSettings}
          onLogout={handleLogout}
          onBack={() => navigate({ screen: 'dashboard' })}
        />
      )}

      {screen === 'testing-battery' && store.userProfile && (
        <TestingBattery
          position={store.userProfile.position}
          previousSession={store.testSessions.length > 0
            ? store.testSessions.reduce((a, b) => a.completedAt > b.completedAt ? a : b)
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

      {screen === 'programme-builder' && store.userProfile && premium.hasAccess && (
        <ProgrammeBuilder
          userProfile={store.userProfile}
          onGenerate={handleGenerateProgramme}
          onBack={() => navigate({ screen: 'plans' })}
          existingStrengthSetup={
            store.generatedProgrammes
              .filter(p => p.strengthSetup)
              .sort((a, b) => b.createdAt - a.createdAt)[0]?.strengthSetup
          }
        />
      )}

      {screen === 'paywall' && (
        <Paywall
          featureLabel={paywallFeatureLabel}
          trialDaysLeft={premium.trialDaysLeft}
          isTrialExpired={premium.isTrialExpired}
          purchasing={premium.purchasing}
          restoring={premium.restoring}
          purchaseError={premium.purchaseError}
          onStartTrial={() => {
            premium.startTrial();
            navigate({ screen: 'programme-builder' });
          }}
          onSelectPlan={async (plan) => {
            if (!Capacitor.isNativePlatform()) {
              // Web: Stripe Checkout — store plan so we can grant it on return
              const userId = cloudUserIdRef.current;
              if (!userId) {
                if (import.meta.env.DEV) console.warn('[Stripe] Cannot start checkout — no authenticated user ID.');
                return;
              }
              const userEmail = (await supabase?.auth.getUser())?.data.user?.email ?? '';
              sessionStorage.setItem('vf_stripe_plan', plan);
              const result = await createStripeCheckout(plan, userId, userEmail);
              if ('url' in result) {
                window.location.href = result.url;
              } else {
                // Surface the error so the user knows something went wrong
                premium.setPurchaseError(result.error ?? 'Could not start checkout. Please try again.');
              }
              return;
            }
            const ok = await premium.purchase(plan);
            if (ok) navigate({ screen: 'programme-builder' });
          }}
          onRestore={async () => {
            const ok = await premium.restore();
            if (ok) navigate({ screen: 'programme-builder' });
          }}
          onRedeemCode={async (code) => {
            const err = await premium.redeemPromo(code);
            if (!err) setTimeout(() => navigate({ screen: 'programme-builder' }), REFERRAL_REDIRECT_DELAY_MS);
            return err;
          }}
          onRedeemReferral={async (code) => {
            const userId = cloudUserIdRef.current ?? '';
            const err = await premium.redeemReferral(code, userId);
            if (!err) setTimeout(() => navigate({ screen: 'programme-builder' }), REFERRAL_REDIRECT_DELAY_MS);
            return err;
          }}
          onDismiss={() => {
            // If new user (no sessions yet) coming from onboarding, go to dashboard + show welcome
            if (!store.sessions.length && !store.generatedProgrammes.length) {
              navigate({ screen: 'dashboard' });
              setShowProgrammePrompt(true);
            } else {
              navigate({ screen: 'plans' });
            }
          }}
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
            exercises={store.exercises}
            onBack={() => navigate({ screen: 'plans' })}
            onRebuild={() => navigate({ screen: 'programme-builder' })}
            onApply={(startDate) => {
              const updated = { ...prog, programmeStartDate: startDate };
              store.saveGeneratedProgramme(updated);
              store.setActiveProgrammeId(prog.id);
              setCurrentProgramme(updated);
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

      {pendingReTestSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">📊</span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 text-center mb-2">Tests saved!</h2>
            <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
              You have an active programme. Apply your new test results so the training adjusts to your current fitness profile?
            </p>
            {pendingReTestSession.grades && Object.keys(pendingReTestSession.grades).length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">What will change:</p>
                {buildTestEmphasis(pendingReTestSession.grades).coachNotes.length > 0
                  ? buildTestEmphasis(pendingReTestSession.grades).coachNotes.map((note, i) => (
                      <p key={i} className="text-xs text-blue-600 leading-relaxed mb-1">• {note}</p>
                    ))
                  : <p className="text-xs text-blue-500 italic">Your grades are good — no major adjustments needed. Standard plan continues.</p>
                }
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => applyRetestToProgramme(pendingReTestSession)}
                className="w-full py-3 bg-brand-500 text-white rounded-2xl font-bold text-sm hover:bg-brand-600 transition-colors"
              >
                Apply to current plan
              </button>
              <button
                onClick={() => { setPendingReTestSession(null); navigate({ screen: 'dashboard' }); }}
                className="w-full py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
              >
                Just save results, don't change my plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test grades confirmation popup — shown before programme generation when grades exist */}
      {testGradesInputs && pendingTestGrades && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🧪</span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 text-center mb-2">Test Results Available</h2>
            <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
              Your recent testing data can personalise this programme — extra focus where your grades show room to improve.
            </p>
            <div className="mb-4 p-3 bg-brand-50 rounded-xl border border-brand-200">
              <p className="text-xs font-semibold text-brand-700 mb-1.5">What will be adjusted:</p>
              {buildTestEmphasis(pendingTestGrades).coachNotes.length > 0
                ? buildTestEmphasis(pendingTestGrades).coachNotes.map((note, i) => (
                    <p key={i} className="text-xs text-brand-600 leading-relaxed mb-1">• {note}</p>
                  ))
                : <p className="text-xs text-brand-500 italic">Your grades are strong — no major adjustments needed.</p>
              }
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const inp = { ...testGradesInputs, testGrades: pendingTestGrades };
                  setTestGradesInputs(null); setPendingTestGrades(null);
                  doGenerateProgramme(inp);
                }}
                className="w-full py-3 bg-brand-500 text-white rounded-2xl font-bold text-sm hover:bg-brand-600 transition-colors"
              >
                Apply test results
              </button>
              <button
                onClick={() => {
                  const inp = { ...testGradesInputs };
                  setTestGradesInputs(null); setPendingTestGrades(null);
                  doGenerateProgramme(inp);
                }}
                className="w-full py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
              >
                Skip — use standard programme
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgrammePrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 mx-auto shadow-lg">
              <Zap size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 text-center mb-2">
              Welcome to Vector Football!
            </h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-4">
              Ready to build your personalised training programme? It only takes a minute and uses everything you just told us.
            </p>
            <div className="flex items-center justify-center gap-1.5 mb-5">
              <span className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">14-day free trial · no card needed</span>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowProgrammePrompt(false);
                  navigateGated({ screen: 'programme-builder' }, 'Programme Builder');
                }}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-md"
              >
                Build My Programme
              </button>
              <button
                onClick={() => setShowProgrammePrompt(false)}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Explore First
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingWorkout && (() => {
        const r = store.getTodayReadiness();
        const isElite = r?.level === 'elite';
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-5">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-xl">
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
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${isElite ? 'bg-brand-100' : 'bg-amber-100'}`}>
                  {isElite
                    ? <Zap size={22} className="text-brand-500" />
                    : <Battery size={22} className="text-amber-500" />
                  }
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {isElite ? 'Peak Readiness 🔥' : 'Low Readiness Detected'}
                  </h3>
                  <p className={`text-xs font-semibold ${isElite ? 'text-brand-600' : 'text-amber-600'}`}>
                    Score {r?.score.toFixed(1) ?? '—'} / 5 · {isElite ? 'Elite' : 'Low'}
                  </p>
                </div>
              </div>

              {isElite ? (
                <>
                  <p className="text-sm text-gray-600 mb-5">
                    You're firing on all cylinders today. Add a <strong>bonus set</strong> to every exercise and make the most of it — load and reps stay the same.
                  </p>
                  <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-5 text-xs text-brand-800">
                    <p className="font-semibold mb-1">If you add bonus sets:</p>
                    <p>Every exercise gains 1 extra set. Weight and reps stay unchanged.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const boosted = pendingWorkout.items.map(ex => ({
                          ...ex,
                          targetSets: ex.targetSets + 1,
                        }));
                        setPendingWorkout(null);
                        launchWorkout(pendingWorkout.name, boosted);
                      }}
                      className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors"
                    >
                      Add Bonus Set (+1 each)
                    </button>
                    <button
                      onClick={() => {
                        const { name, items } = pendingWorkout;
                        setPendingWorkout(null);
                        launchWorkout(name, items);
                      }}
                      className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
                    >
                      Standard Volume
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-5">
                    Your readiness score is low today. Reducing <strong>volume</strong> (fewer sets) lets you train without overloading a tired body — load and reps stay the same.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800">
                    <p className="font-semibold mb-1">If you reduce volume:</p>
                    <p>Each exercise drops by 1 set (minimum 1). Weight, reps, and rest stay unchanged.</p>
                  </div>
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
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showGlobalStrengthSetup && (() => {
        const activeProg = getActiveProgramme();
        if (!activeProg) return null;
        return (
          <StrengthSetupModal
            programme={activeProg}
            onSave={(setup) => {
              const updated = { ...activeProg, strengthSetup: setup };
              store.saveGeneratedProgramme(updated);
              setCurrentProgramme(updated);
              setShowGlobalStrengthSetup(false);
            }}
            onClose={() => setShowGlobalStrengthSetup(false)}
          />
        );
      })()}

      {showReviewPrompt && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⭐</div>
              <h2 className="font-extrabold text-gray-900 text-lg mb-1">Enjoying Vector Football?</h2>
              <p className="text-sm text-gray-500 leading-snug">
                A quick rating helps other footballers find the app and takes 10 seconds.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setShowReviewPrompt(false);
                  localStorage.setItem('vf_review_prompted', String(Date.now()));
                  trackEvent('review_prompt_yes');
                  if (Capacitor.isNativePlatform()) {
                    const { InAppReview } = await import('@capacitor-community/in-app-review');
                    await InAppReview.requestReview();
                  } else {
                    window.open(APP_STORE_URL, '_blank');
                  }
                }}
                className="w-full py-3 bg-brand-500 text-white font-bold rounded-2xl text-sm hover:bg-brand-600 transition-colors"
              >
                Rate Vector Football ⭐
              </button>
              <button
                onClick={() => {
                  setShowReviewPrompt(false);
                  localStorage.setItem('vf_review_prompted', String(Date.now()));
                  trackEvent('review_prompt_dismissed');
                }}
                className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgrammeComplete && (() => {
        const prog = getActiveProgramme();
        const progSessions = store.sessions.filter(s => {
          if (!prog) return false;
          const anchorDate = prog.programmeStartDate ?? new Date(prog.createdAt).toISOString().split('T')[0];
          return s.date >= anchorDate;
        });
        const totalVol = progSessions.reduce((a, s) =>
          a + s.exercises.reduce((b, e) =>
            b + e.sets.filter(set => !set.isPriming && set.weight > 0).reduce((c, set) => c + set.weight * set.reps, 0), 0), 0);
        const tests = [...store.testSessions].sort((a, b) => a.completedAt - b.completedAt);
        const firstTest = tests[0];
        const lastTest = tests.length > 1 ? tests[tests.length - 1] : null;
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-brand-600 to-brand-400 px-6 pt-8 pb-6 text-white text-center">
                <div className="text-5xl mb-2">🏆</div>
                <h2 className="font-extrabold text-2xl mb-1">Programme Complete!</h2>
                <p className="text-white/80 text-sm">
                  {prog ? `${prog.durationWeeks}-week programme finished` : 'Great work'}
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-2xl p-3 text-center">
                    <div className="text-2xl font-extrabold text-brand-500">{progSessions.length}</div>
                    <div className="text-xs text-gray-500 mt-0.5">sessions done</div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3 text-center">
                    <div className="text-2xl font-extrabold text-brand-500">
                      {totalVol >= 1000 ? `${(totalVol / 1000).toFixed(0)}k` : totalVol}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">kg volume lifted</div>
                  </div>
                  {firstTest && lastTest && (() => {
                    const firstYoyo = firstTest.results.find(r => r.type === 'yoyo' && !r.skipped);
                    const lastYoyo  = lastTest.results.find(r => r.type === 'yoyo' && !r.skipped);
                    if (!firstYoyo || !lastYoyo) return null;
                    const deltaNum = lastYoyo.best - firstYoyo.best;
                    const delta = deltaNum.toFixed(1);
                    return (
                      <div className={`col-span-2 rounded-2xl p-3 text-center border ${deltaNum >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`text-lg font-extrabold ${deltaNum >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          Yo-Yo {deltaNum >= 0 ? '+' : ''}{delta} levels
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">aerobic improvement</div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setShowProgrammeComplete(false);
                      store.setActiveProgrammeId(null);
                      navigate({ screen: 'programme-builder' });
                      trackEvent('programme_completed', { sessions: progSessions.length });
                    }}
                    className="w-full py-3 bg-brand-500 text-white font-bold rounded-2xl text-sm hover:bg-brand-600"
                  >
                    Build Next Programme
                  </button>
                  <button
                    onClick={() => {
                      setShowProgrammeComplete(false);
                      navigate({ screen: 'generated-programme' });
                    }}
                    className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors"
                  >
                    View programme summary
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Notification permission prompt — shown once after first programme */}
      {showNotifPrompt && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-7 pb-2 text-center">
              <div className="text-4xl mb-3">🔔</div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Never miss a session</h2>
              <p className="text-sm text-gray-500 mb-6">Get a reminder before each training session on your programme so you always stay on track.</p>
              <button
                onClick={async () => {
                  localStorage.setItem('vf_notif_prompted', '1');
                  setShowNotifPrompt(false);
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    const { reminderHour, reminderMinute } = store.userSettings;
                    store.updateSettings({ reminderEnabled: true });
                    if (notifPendingProgramme) {
                      scheduleTrainingReminders(notifPendingProgramme, reminderHour, reminderMinute);
                    } else {
                      scheduleDailyReminder(reminderHour, reminderMinute);
                    }
                    trackEvent('reminder_enabled', { source: 'post_programme_prompt', hour: reminderHour, minute: reminderMinute });
                  }
                  setNotifPendingProgramme(null);
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors mb-3"
              >
                Enable Reminders
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('vf_notif_prompted', '1');
                  setShowNotifPrompt(false);
                  setNotifPendingProgramme(null);
                }}
                className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-2"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily trial prompt — shown once per day to free users with no active trial */}
      {showTrialPrompt && !premium.hasAccess && !premium.isTrialActive && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-500 px-6 pt-6 pb-8 text-white text-center relative">
              <button
                onClick={() => {
                  localStorage.setItem('vf_trial_prompt_shown', new Date().toISOString().split('T')[0]);
                  setShowTrialPrompt(false);
                }}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <span className="text-white text-sm font-bold">✕</span>
              </button>
              <div className="text-4xl mb-2">⚡</div>
              <h2 className="text-xl font-extrabold mb-1">Try Pro Free for 14 Days</h2>
              <p className="text-sm text-white/80">No card needed. Cancel anytime.</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex flex-col gap-2.5 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">📋</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Smart Programme Builder</p>
                    <p className="text-xs text-gray-500">Position-specific, periodised to your fixtures</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">📊</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Training Load Analytics</p>
                    <p className="text-xs text-gray-500">Weekly load chart & injury risk monitoring</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('vf_trial_prompt_shown', new Date().toISOString().split('T')[0]);
                  setShowTrialPrompt(false);
                  navigate({ screen: 'paywall' });
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors"
              >
                Start Free Trial
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">No payment required · £7.99/mo after trial</p>
            </div>
          </div>
        </div>
      )}
      </Suspense>
    </div>
  );
}
