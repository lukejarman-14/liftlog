import { useState, useCallback, useEffect, useRef, lazy, Suspense, startTransition } from 'react';
import { Battery, Zap, X } from 'lucide-react';
import { captureError, setSentryUser } from './lib/sentry';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
import { useStore } from './hooks/useStore';
import { Navigation } from './components/Navigation';
import { AppBootSkeleton, DashboardSkeleton, LoginSkeleton } from './components/SkeletonScreens';
import { CookieBanner } from './components/CookieBanner';
import { Dashboard } from './components/screens/Dashboard';
import type { FormationData } from './components/screens/FormationBuilder';
import { NavState, WorkoutExercise, WorkoutSession, UserProfile, TestSession, ProgrammeSession } from './types';
import { POSITION_TEMPLATES } from './data/positionPlans';
import { sessionToLegacyTest, calcBaselineResults } from './data/testingBattery';
import { generateProgramme, buildTestEmphasis } from './lib/programmeGenerator';
import { sessionToWorkoutExercises, getProgrammeWeekIndex } from './lib/sessionUtils';
import { ProgrammeInputs, GeneratedProgramme as GPType } from './types';
import { usePremium } from './hooks/usePremium';
import { rcConfigure, rcLogOut } from './lib/revenueCat';
import { createStripeCheckout, createStripePortalSession } from './lib/stripeCheckout';
import { Capacitor } from '@capacitor/core';
import {
  isSupabaseConfigured,
  cloudSignOut,
  clearDataOwnership,
  cloudSaveData,
  cloudLoadData,
  cloudDeleteAccount,
  getExistingSession,
} from './lib/cloudSync';
import { supabase } from './lib/supabase';
import { registerSquad, joinSquad } from './lib/teams';
import { identifyUser, resetAnalyticsUser, trackEvent, applyAnalyticsOptOut } from './lib/analytics';
import { scheduleTrainingReminders, cancelAllTrainingReminders, requestNotificationPermission, scheduleDailyReminder } from './lib/notifications';
import { localDateStr } from './lib/loadManagement';

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
import { TermsGateModal } from './components/TermsGateModal';
import { SquadEndedModal } from './components/SquadEndedModal';
const ProgrammeHub       = lazy(() => import('./components/screens/ProgrammeHub').then(m => ({ default: m.ProgrammeHub })));
const ResetPassword      = lazy(() => import('./components/screens/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Paywall            = lazy(() => import('./components/screens/Paywall').then(m => ({ default: m.Paywall })));
const CoachDashboard     = lazy(() => import('./components/screens/CoachDashboard').then(m => ({ default: m.CoachDashboard })));
// Demo data for the coach dashboard preview (branch-only, remove before launch).
import { DEMO_TEAMS, type MatchResult, type SquadPlayer, type SquadGroup } from './components/screens/CoachDashboard';

const DEMO_PLAYERS: SquadPlayer[] = [
  { id: 'demo-1', name: 'James Thornton', position: 'Goalkeeper', group: 'Defence', readiness: 'ready', available: true, improvementScore: 65, programmeName: 'GK Programme', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.92s', change: '-0.03s', improved: true }, { label: '30m Sprint', value: '4.45s', change: '-0.04s', improved: true }, { label: 'CMJ', value: '36cm', change: '+2cm', improved: true }, { label: 'Standing Long Jump', value: '230cm', change: '+4cm', improved: true }, { label: 'RSA (6×30m)', value: '4.72s', change: '-0.02s', improved: true }, { label: 'Yo-Yo IR1', value: '16.8', change: '+0.4', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'GK Shot-stopping', rpe: 7 }, { date: 'Wed 28 May', label: 'Distribution & Footwork', rpe: 6 }] },
  { id: 'demo-2', name: 'Marcus Webb', position: 'Centre-Back', group: 'Defence', readiness: 'ready', available: true, improvementScore: 72, programmeName: 'Defender S&C', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.88s', change: '-0.04s', improved: true }, { label: '30m Sprint', value: '4.32s', change: '-0.05s', improved: true }, { label: 'CMJ', value: '39cm', change: '+2cm', improved: true }, { label: 'Standing Long Jump', value: '242cm', change: '+5cm', improved: true }, { label: 'RSA (6×30m)', value: '4.58s', change: '-0.03s', improved: true }, { label: 'Yo-Yo IR1', value: '17.4', change: '+0.3', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Strength & Power', rpe: 8 }, { date: 'Wed 28 May', label: 'Speed Endurance', rpe: 7 }] },
  { id: 'demo-3', name: 'Tyler Shaw', position: 'Centre-Back', group: 'Defence', readiness: 'moderate', available: true, improvementScore: 58, programmeName: 'Defender S&C', sessionsThisWeek: 2, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.95s', change: '+0.01s', improved: false }, { label: '30m Sprint', value: '4.51s', change: '+0.02s', improved: false }, { label: 'CMJ', value: '35cm', change: '-1cm', improved: false }, { label: 'Standing Long Jump', value: '228cm', change: '-2cm', improved: false }, { label: 'RSA (6×30m)', value: '4.80s', change: '+0.06s', improved: false }, { label: 'Yo-Yo IR1', value: '16.2', change: '-0.3', improved: false }],
    recentActivity: [{ date: 'Thu 29 May', label: 'Recovery Run', rpe: 4 }, { date: 'Mon 26 May', label: 'Strength Base', rpe: 7 }] },
  { id: 'demo-4', name: 'Liam Carter', position: 'Right Back', group: 'Defence', readiness: 'ready', available: true, improvementScore: 80, programmeName: 'Full-Back Power', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.80s', change: '-0.06s', improved: true }, { label: '30m Sprint', value: '4.18s', change: '-0.07s', improved: true }, { label: 'CMJ', value: '43cm', change: '+3cm', improved: true }, { label: 'Standing Long Jump', value: '254cm', change: '+6cm', improved: true }, { label: 'RSA (6×30m)', value: '4.38s', change: '-0.05s', improved: true }, { label: 'Yo-Yo IR1', value: '18.2', change: '+0.6', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Speed & Acceleration', rpe: 8 }, { date: 'Wed 28 May', label: 'Plyometrics', rpe: 7 }, { date: 'Mon 26 May', label: 'Lower Body Power', rpe: 8 }] },
  { id: 'demo-5', name: 'Noah Barnes', position: 'Left Back', group: 'Defence', readiness: 'low', available: false, injury: 'Hamstring', improvementScore: 40, programmeName: 'Full-Back Power', sessionsThisWeek: 1, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.86s', change: '+0.03s', improved: false }, { label: '30m Sprint', value: '4.28s', change: '+0.04s', improved: false }, { label: 'CMJ', value: '40cm', change: '-2cm', improved: false }, { label: 'Standing Long Jump', value: '247cm', change: '-3cm', improved: false }, { label: 'RSA (6×30m)', value: '4.52s', change: '+0.08s', improved: false }, { label: 'Yo-Yo IR1', value: '17.6', change: '-0.4', improved: false }],
    recentActivity: [{ date: 'Mon 26 May', label: 'Rehab Session', rpe: 3 }] },
  { id: 'demo-6', name: 'Ethan Clarke', position: 'Defensive Mid', group: 'Midfield', readiness: 'ready', available: true, improvementScore: 88, programmeName: 'Midfielder S&C', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.82s', change: '-0.05s', improved: true }, { label: '30m Sprint', value: '4.22s', change: '-0.06s', improved: true }, { label: 'CMJ', value: '42cm', change: '+3cm', improved: true }, { label: 'Standing Long Jump', value: '251cm', change: '+7cm', improved: true }, { label: 'RSA (6×30m)', value: '4.42s', change: '-0.06s', improved: true }, { label: 'Yo-Yo IR1', value: '18.6', change: '+0.8', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Speed & Power', rpe: 8 }, { date: 'Wed 28 May', label: 'Strength Block', rpe: 8 }, { date: 'Mon 26 May', label: 'Conditioning', rpe: 7 }] },
  { id: 'demo-7', name: 'Ryan Patel', position: 'Central Mid', group: 'Midfield', readiness: 'moderate', available: true, improvementScore: 70, programmeName: 'Midfielder S&C', sessionsThisWeek: 2, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.85s', change: '-0.02s', improved: true }, { label: '30m Sprint', value: '4.28s', change: '-0.02s', improved: true }, { label: 'CMJ', value: '40cm', change: '+1cm', improved: true }, { label: 'Standing Long Jump', value: '245cm', change: '+2cm', improved: true }, { label: 'RSA (6×30m)', value: '4.55s', change: '-0.02s', improved: true }, { label: 'Yo-Yo IR1', value: '17.9', change: '+0.2', improved: true }],
    recentActivity: [{ date: 'Thu 29 May', label: 'Strength Base', rpe: 7 }, { date: 'Tue 27 May', label: 'Speed Work', rpe: 6 }] },
  { id: 'demo-8', name: 'Jordan Ellis', position: 'Central Mid', group: 'Midfield', readiness: 'ready', available: true, improvementScore: 75, programmeName: 'Midfielder S&C', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.84s', change: '-0.03s', improved: true }, { label: '30m Sprint', value: '4.25s', change: '-0.04s', improved: true }, { label: 'CMJ', value: '41cm', change: '+2cm', improved: true }, { label: 'Standing Long Jump', value: '249cm', change: '+4cm', improved: true }, { label: 'RSA (6×30m)', value: '4.48s', change: '-0.04s', improved: true }, { label: 'Yo-Yo IR1', value: '18.1', change: '+0.5', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Power & Speed', rpe: 7 }, { date: 'Wed 28 May', label: 'Lower Body Strength', rpe: 8 }, { date: 'Mon 26 May', label: 'Conditioning', rpe: 7 }] },
  { id: 'demo-9', name: 'Sam Hughes', position: 'Right Wing', group: 'Attack', readiness: 'ready', available: true, improvementScore: 91, programmeName: 'Winger Speed', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.72s', change: '-0.07s', improved: true }, { label: '30m Sprint', value: '3.95s', change: '-0.08s', improved: true }, { label: 'CMJ', value: '48cm', change: '+4cm', improved: true }, { label: 'Standing Long Jump', value: '265cm', change: '+8cm', improved: true }, { label: 'RSA (6×30m)', value: '4.22s', change: '-0.07s', improved: true }, { label: 'Yo-Yo IR1', value: '19.2', change: '+1.0', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Sprint Development', rpe: 8 }, { date: 'Wed 28 May', label: 'Plyometrics', rpe: 8 }, { date: 'Mon 26 May', label: 'Speed Endurance', rpe: 7 }] },
  { id: 'demo-10', name: 'Leo Marsh', position: 'Left Wing', group: 'Attack', readiness: 'moderate', available: true, improvementScore: 62, programmeName: 'Winger Speed', sessionsThisWeek: 2, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.78s', change: '-0.03s', improved: true }, { label: '30m Sprint', value: '4.08s', change: '-0.03s', improved: true }, { label: 'CMJ', value: '44cm', change: '+1cm', improved: true }, { label: 'Standing Long Jump', value: '257cm', change: '+3cm', improved: true }, { label: 'RSA (6×30m)', value: '4.32s', change: '-0.03s', improved: true }, { label: 'Yo-Yo IR1', value: '18.5', change: '+0.4', improved: true }],
    recentActivity: [{ date: 'Thu 29 May', label: 'Speed Work', rpe: 7 }, { date: 'Tue 27 May', label: 'Power Training', rpe: 7 }] },
  { id: 'demo-11', name: 'Kai Foster', position: 'Striker', group: 'Attack', readiness: 'ready', available: true, improvementScore: 85, programmeName: 'Striker Power', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.75s', change: '-0.05s', improved: true }, { label: '30m Sprint', value: '4.02s', change: '-0.06s', improved: true }, { label: 'CMJ', value: '46cm', change: '+3cm', improved: true }, { label: 'Standing Long Jump', value: '260cm', change: '+6cm', improved: true }, { label: 'RSA (6×30m)', value: '4.28s', change: '-0.05s', improved: true }, { label: 'Yo-Yo IR1', value: '18.9', change: '+0.7', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Lower Body Power', rpe: 9 }, { date: 'Wed 28 May', label: 'Sprint Mechanics', rpe: 8 }, { date: 'Mon 26 May', label: 'Strength Block', rpe: 8 }] },
  { id: 'demo-12', name: 'Finn Murphy', position: 'Striker', group: 'Attack', readiness: 'ready', available: true, improvementScore: 77, programmeName: 'Striker Power', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.77s', change: '-0.04s', improved: true }, { label: '30m Sprint', value: '4.05s', change: '-0.05s', improved: true }, { label: 'CMJ', value: '45cm', change: '+2cm', improved: true }, { label: 'Standing Long Jump', value: '258cm', change: '+5cm', improved: true }, { label: 'RSA (6×30m)', value: '4.30s', change: '-0.04s', improved: true }, { label: 'Yo-Yo IR1', value: '18.7', change: '+0.5', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Power Development', rpe: 8 }, { date: 'Wed 28 May', label: 'Speed & Agility', rpe: 7 }, { date: 'Mon 26 May', label: 'Conditioning', rpe: 8 }] },
  { id: 'demo-13', name: 'Oscar Reid', position: 'Winger', group: 'Attack', readiness: 'moderate', available: true, improvementScore: 55, programmeName: 'Winger Speed', sessionsThisWeek: 2, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.81s', change: '-0.01s', improved: true }, { label: '30m Sprint', value: '4.15s', change: '-0.01s', improved: true }, { label: 'CMJ', value: '42cm', change: '0cm', improved: false }, { label: 'Standing Long Jump', value: '250cm', change: '+1cm', improved: true }, { label: 'RSA (6×30m)', value: '4.45s', change: '+0.01s', improved: false }, { label: 'Yo-Yo IR1', value: '17.8', change: '+0.1', improved: true }],
    recentActivity: [{ date: 'Thu 29 May', label: 'Speed Endurance', rpe: 6 }, { date: 'Tue 27 May', label: 'Plyometrics', rpe: 7 }] },
  { id: 'demo-14', name: 'Callum Price', position: 'Centre-Back', group: 'Defence', readiness: 'ready', available: true, improvementScore: 68, programmeName: 'Defender S&C', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.90s', change: '-0.02s', improved: true }, { label: '30m Sprint', value: '4.38s', change: '-0.03s', improved: true }, { label: 'CMJ', value: '37cm', change: '+1cm', improved: true }, { label: 'Standing Long Jump', value: '235cm', change: '+3cm', improved: true }, { label: 'RSA (6×30m)', value: '4.65s', change: '-0.03s', improved: true }, { label: 'Yo-Yo IR1', value: '17.0', change: '+0.2', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Strength & Conditioning', rpe: 7 }, { date: 'Wed 28 May', label: 'Speed Work', rpe: 6 }, { date: 'Mon 26 May', label: 'Lower Body Strength', rpe: 8 }] },
  { id: 'demo-15', name: 'Harvey Stone', position: 'Midfielder', group: 'Midfield', readiness: 'ready', available: true, improvementScore: 73, programmeName: 'Midfielder S&C', sessionsThisWeek: 3, sessionsTarget: 3,
    testing: [{ label: '10m Sprint', value: '1.83s', change: '-0.04s', improved: true }, { label: '30m Sprint', value: '4.23s', change: '-0.04s', improved: true }, { label: 'CMJ', value: '41cm', change: '+2cm', improved: true }, { label: 'Standing Long Jump', value: '248cm', change: '+4cm', improved: true }, { label: 'RSA (6×30m)', value: '4.48s', change: '-0.03s', improved: true }, { label: 'Yo-Yo IR1', value: '18.0', change: '+0.4', improved: true }],
    recentActivity: [{ date: 'Fri 30 May', label: 'Conditioning Block', rpe: 7 }, { date: 'Wed 28 May', label: 'Speed & Power', rpe: 7 }, { date: 'Mon 26 May', label: 'Strength Base', rpe: 8 }] },
];

// check for password reset link on both implicit (#type=recovery) and PKCE (?code=) flows
function detectRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    sessionStorage.getItem('vf_recovery_mode') === '1'
  );
}

// Detect email confirmation redirect — Supabase appends #type=signup after the user clicks the link
function detectEmailConfirmUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hash.includes('type=signup');
}

function EmailConfirmedLanding() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-green-100 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Email confirmed!</h1>
      <p className="text-gray-500 text-sm max-w-xs mb-8 leading-relaxed">
        Your email address has been verified. Return to the Vector Football app and tap{' '}
        <span className="font-semibold text-gray-700">"I've confirmed my email"</span>{' '}
        to continue.
      </p>
      <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M12 12.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="mt-3 text-xs text-gray-400">You can close this tab.</p>
    </div>
  );
}

export default function App() {
  const store = useStore();
  const toast = useToast();
  const [nav, setNav] = useState<NavState>({ screen: 'dashboard' });
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [currentProgramme, setCurrentProgramme] = useState<GPType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // true while we confirm whether a Supabase session exists (skip spinner for recovery URLs)
  const [sessionChecking, setSessionChecking] = useState(isSupabaseConfigured && !detectRecoveryUrl());
  // true when the user has arrived via a password-reset link — bypasses profile/auth guards
  const [isRecoveryMode, setIsRecoveryMode] = useState(detectRecoveryUrl);
  // true when the user has arrived via an email confirmation link — show landing page
  const [isEmailConfirmLanding] = useState(detectEmailConfirmUrl);

  const cloudUserIdRef = useRef<string | null>(null);
  const appMountedRef  = useRef(true);
  useEffect(() => () => { appMountedRef.current = false; }, []);
  const [showProgrammePrompt, setShowProgrammePrompt] = useState(false);
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);
  // Shown to a personal player whose squad (coach) access has ended — prompts them to keep Premium.
  // In production this flag is set when the player's coach link is revoked. For preview, set
  // localStorage 'vf_squad_ended' = '1' and reload.
  const [showSquadEnded, setShowSquadEnded] = useState(() => {
    try { return localStorage.getItem('vf_squad_ended') === '1'; } catch { return false; }
  });
  // Squad-join feedback toast: 'pro' (got Premium), 'free' (joined, no Premium), or an error reason.
  const [squadJoinToast, setSquadJoinToast] = useState<null | 'pro' | 'free' | 'invalid'>(null);
  // Live squad members fetched from Supabase for the coach dashboard
  const [liveSquadPlayers, setLiveSquadPlayers] = useState<SquadPlayer[]>([]);
  // Live announcements for the coach dashboard
  const [liveAnnouncements, setLiveAnnouncements] = useState<{ id: string; date: string; text: string }[]>([]);
  // Announcements from the player's coach (shown on player dashboard)
  const [playerCoachAnnouncements, setPlayerCoachAnnouncements] = useState<{ id: string; date: string; text: string }[]>([]);
  // Live schedule weeks for the coach dashboard
  const [liveScheduleWeeks, setLiveScheduleWeeks] = useState<import('./components/screens/CoachDashboard').ScheduleWeek[]>([]);
  // Player's squad profile (display name, position, jersey)
  const [squadProfile, setSquadProfile] = useState<{ displayName: string; position: string; jerseyNumber: number | null } | undefined>();
  // Coach: match results
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  // Coach: saved attendance records
  const [savedAttendance, setSavedAttendance] = useState<Array<{ session_date: string; session_title: string; attendance: Record<string, boolean> }>>([]);
  const [showGlobalStrengthSetup, setShowGlobalStrengthSetup] = useState(false);
  const [pendingReTestSession, setPendingReTestSession] = useState<TestSession | null>(null);
  const [myReferralCode, setMyReferralCode] = useState<string | undefined>();
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showProgrammeComplete, setShowProgrammeComplete] = useState(false);

  const premium = usePremium();
  const [paywallFeatureLabel, setPaywallFeatureLabel] = useState<string | undefined>();
  const [showTrialPrompt, setShowTrialPrompt] = useState(false);
  const [stripeCheckoutPending, setStripeCheckoutPending] = useState(false);
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
          // Unblock the UI immediately — the spinner disappears as soon as we know
          // the auth state. All background syncs (cloud, RC) continue after this.
          setSessionChecking(false);
          // Register coach/club squad or finish a pending player join.
          void syncSquad(userId);
          if (!sessionStorage.getItem('vf_boot_synced')) {
            sessionStorage.setItem('vf_boot_synced', '1');
            const hadCloudData = await cloudLoadData(userId);
            // New account: cloudSaveData at signup may have failed because the session
            // didn't exist yet (email confirmation pending, RLS blocked the write).
            // If there's no cloud row for this user, push whatever is in localStorage
            // so future refreshes load the correct profile + accountType.
            if (!hadCloudData) {
              await cloudSaveData(userId).catch(() => {});
            }
            // Re-read premium from localStorage now that cloudLoadData has written the
            // server-authoritative value.  usePremium uses plain useState (not
            // useLocalStorage), so it won't pick up the vf-cloud-restored event on its own.
            premium.refresh();
          }
          await rcConfigure(userId).catch(err => {
            if (import.meta.env.DEV) console.warn('[RC] configure failed:', err);
          });
          await premium.syncFromRC();
          // Server-authoritative access (Stripe web, squad-inherited, promo/referral).
          await premium.syncEntitlementFromServer();

          const today = new Date().toISOString().split('T')[0];
          const lastShown = localStorage.getItem('vf_trial_prompt_shown');
          // Read directly from localStorage after syncFromRC has written — avoids calling
          // refresh() which triggers an extra setStatusRaw state update inside this async chain.
          const premiumAfterSync = (() => {
            try {
              const s = JSON.parse(localStorage.getItem('vf_premium') ?? '{}');
              // Also treat active timed grants (referral/promo) as having access
              return s.isPremium === true || (s.expiresAt && s.expiresAt > Date.now());
            }
            catch { return false; }
          })();
          if (lastShown !== today && !premiumAfterSync) {
            setTimeout(() => setShowTrialPrompt(true), TRIAL_PROMPT_DELAY_MS);
          }
          // If DB write fails, leave referral code undefined — card won't render
          // but the app still boots normally. Code will be registered on next boot.
          const code = await premium.getOrCreateReferralCode(userId).catch(() => undefined);
          setMyReferralCode(code);
          await premium.claimReferralRewardsForUser(userId);

          const params = new URLSearchParams(window.location.search);
          if (params.get('stripe_success') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
            // The vf_stripe_plan hint is no longer trusted to GRANT access — clear it.
            sessionStorage.removeItem('vf_stripe_plan');
            // Access is granted ONLY by the server: poll the authoritative entitlement
            // (populated by the Stripe webhook) for up to 10s. Never grant from the URL
            // param or sessionStorage — that path was a free-premium bypass.
            let confirmed = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              if (!appMountedRef.current) break;
              await new Promise<void>(r => setTimeout(r, 1000));
              if (!appMountedRef.current) break;
              const ent = await premium.syncEntitlementFromServer();
              if (ent.isPremium) { confirmed = true; break; }
            }
            if (!appMountedRef.current) return;
            if (confirmed) navigate({ screen: 'programme-builder' });
          } else if (params.get('stripe_cancel') === '1') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      })
      .catch(() => { /* session check failed — continue as unauthenticated */ })
      .finally(() => { setSessionChecking(false); });
  // navigate is declared below but is a stable useCallback — intentionally omitted
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Email confirmation link clicked — Supabase fires SIGNED_IN with a fresh
      // session. The boot useEffect has already run (it found no session before
      // the user clicked the link), so we must handle this event to authenticate
      // the user and load their cloud data.
      if (event === 'SIGNED_IN' && session?.user?.id) {
        const userId = session.user.id;
        // Email confirmed — clear the pending confirmation banner
        setPendingEmailConfirm(false);
        // Only act if we're not already authenticated (avoids re-running on
        // normal sign-in flows that are handled by the Login screen directly).
        if (!cloudUserIdRef.current) {
          cloudUserIdRef.current = userId;
          setSessionChecking(false);
          identifyUser(userId);
          // Email confirmation just completed — session now exists so RLS allows writes.
          // Save first (cloudSaveData failed at signup time — no session = 400 from RLS),
          // then load so the store has the correct accountType BEFORE we set isAuthenticated.
          // This prevents a flash of the personal-account paywall for coach accounts.
          cloudSaveData(userId)
            .then(() => cloudLoadData(userId))
            .catch((err) => { captureError(err, { context: 'SIGNED_IN cloud sync', userId }); })
            .finally(() => {
              premium.refresh();
              setSentryUser(userId);
              setIsAuthenticated(true);
            });
          rcConfigure(userId).catch(() => {});
          void syncSquad(userId);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Robustly keep a coach/club squad registered with the right tier whenever the
  // user is authenticated — re-runs when their premium status changes (trial/sub).
  useEffect(() => {
    if (!isAuthenticated) return;
    const acct = store.userProfile?.accountType;
    const uid = cloudUserIdRef.current;
    if (uid && (acct === 'coach' || acct === 'club')) {
      void registerSquad(uid);
    }
  }, [isAuthenticated, store.userProfile?.accountType, premium.hasAccess]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen, store.activeProgrammeId, store.generatedProgrammes, showProgrammeComplete]);

  // Apply analytics opt-out on boot and whenever the user changes the preference.
  useEffect(() => {
    applyAnalyticsOptOut(store.userSettings.analyticsOptOut ?? false);
  }, [store.userSettings.analyticsOptOut]);

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
    store.generatedProgrammes, // re-schedule when programme content changes (e.g. rebuild)
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
    startTransition(() => setNav(next));
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


  const launchWorkout = useCallback((name: string, items: WorkoutExercise[]) => {
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
        methodType: item.methodType,
        sets: [],
      })),
      startTime: Date.now(),
      date: localDateStr(new Date()), // local date, not UTC
    };
    setActiveSession(session);
    startTransition(() => setNav({ screen: 'active-workout' }));
  }, []);

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
    // Capture count before saveSession — React batches the state update, so
    // store.sessions.length would still reflect the pre-save value after the call.
    const completedCount = store.sessions.length + 1;
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
      total_sessions: completedCount,
    });
    if ([5, 15, 30].includes(completedCount)) {
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
    const todayStr = localDateStr(new Date());
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
      if (prev !== undefined) {
        // Only track stagnation once we have a baseline to compare against
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
    store.setActivePlan({ planId, startDate: localDateStr(today) });
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
    // If we have a userId but no Supabase session yet, email confirmation is pending
    if (userId) setPendingEmailConfirm(true);
    // Register the squad (coach/club) or join one (player with a team code) now that
    // we're authenticated. No-op if there's no session yet — retried on next boot.
    if (userId) void syncSquad(userId);
    // Show paywall immediately for new users — if they dismiss it, drop to dashboard with welcome prompt
    setPaywallFeatureLabel(undefined);
    navigate({ screen: 'paywall' });
  };

  // Register a coach/club squad, or join a squad as a player (granting Premium if the
  // coach is on Pro). Safe to call repeatedly — registers are upserts, joins clear the
  // pending code on success. Requires an authenticated session.
  const syncSquad = async (userId: string) => {
    let acct: string | undefined;
    try { acct = JSON.parse(localStorage.getItem('vf_user_profile') || '{}').accountType; } catch { /* ignore */ }
    if (acct === 'coach' || acct === 'club') {
      await registerSquad(userId);
      return;
    }
    const code = localStorage.getItem('vf_pending_team_code');
    if (!code) return;
    const res = await joinSquad(code);
    if (res.success) {
      localStorage.removeItem('vf_pending_team_code');
      if (res.tier === 'pro') {
        localStorage.setItem('vf_premium', JSON.stringify({ isPremium: true, plan: 'monthly', purchasedAt: Date.now(), squadGranted: true }));
        premium.refresh();
        setPendingEmailConfirm(false);
        // Player already has Premium via their coach — skip the paywall entirely.
        navigate({ screen: 'dashboard' });
      }
      setSquadJoinToast(res.tier);
    } else if (res.reason === 'invalid' || res.reason === 'self') {
      localStorage.removeItem('vf_pending_team_code'); // bad code — don't retry forever
      setSquadJoinToast('invalid');
    }
    // 'error' (network/RLS) → keep the code and retry on next authenticated boot
  };

  /** Map position code to group (e.g. 'FB' → 'Defence'). */
  const getPositionGroup = (posCode: string): SquadGroup => {
    if (!posCode) return 'Midfield';
    const code = posCode.toUpperCase();
    if (['GK', 'CB', 'FB', 'LB', 'RB'].includes(code)) return 'Defence';
    if (['CM', 'DM', 'AM'].includes(code)) return 'Midfield';
    if (['W', 'LW', 'RW', 'ST'].includes(code)) return 'Attack';
    return 'Midfield';
  };

  /** Fetch live squad members from Supabase and populate the coach dashboard. */
  const fetchSquadMembers = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_squad_members', { p_coach_id: userId });
      if (error) {
        if (import.meta.env.DEV) console.warn('[squad] fetchSquadMembers error:', error.message);
        return;
      }
      if (!Array.isArray(data)) return;
      // Also fetch player_profiles for real names/positions
      const playerIds = data.map((r: { player_id: string }) => r.player_id);
      const { data: profiles } = playerIds.length > 0
        ? await supabase.from('player_profiles').select('player_id, display_name, position, jersey_number').in('player_id', playerIds)
        : { data: [] };
      const profileMap: Record<string, { display_name: string; position: string; jersey_number: number | null }> = {};
      for (const p of (profiles ?? [])) profileMap[p.player_id] = p;

      const players: SquadPlayer[] = data.map((row: { player_id: string; joined_at: string; email: string; full_name: string }) => {
        const prof = profileMap[row.player_id];
        const posCode = prof?.position || '';
        return {
        id: row.player_id,
        name: prof?.display_name || row.full_name || row.email.split('@')[0],
        position: posCode || 'Player',
        group: getPositionGroup(posCode),
        readiness: 'moderate' as const,
        available: true,
        improvementScore: 0,
        programmeName: '—',
        sessionsThisWeek: 0,
        sessionsTarget: 0,
        testing: [],
        recentActivity: [],
        };
      });
      setLiveSquadPlayers(players);
      if (import.meta.env.DEV) console.log('[squad] live players:', players.length);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[squad] fetchSquadMembers threw:', e);
    }
  }, []);

  // Fetch live squad members whenever the coach dashboard is active
  useEffect(() => {
    const acct = store.userProfile?.accountType;
    if ((acct === 'coach' || acct === 'club') && isAuthenticated && cloudUserIdRef.current) {
      void fetchSquadMembers(cloudUserIdRef.current);
      void fetchAnnouncements(cloudUserIdRef.current);
    }
  }, [isAuthenticated, store.userProfile?.accountType, fetchSquadMembers]);

  /** Fetch live announcements for the coach dashboard. */
  const fetchAnnouncements = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('coach_announcements')
        .select('id, text, created_at')
        .eq('coach_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) { if (import.meta.env.DEV) console.warn('[announcements] fetch error:', error.message); return; }
      const fmt = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      };
      setLiveAnnouncements((data ?? []).map((r: { id: string; text: string; created_at: string }) => ({
        id: r.id, text: r.text, date: fmt(r.created_at),
      })));
    } catch (e) { if (import.meta.env.DEV) console.warn('[announcements] fetch threw:', e); }
  }, []);

  /** Post a new announcement to Supabase. */
  const handlePostAnnouncement = useCallback(async (text: string) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const { error } = await supabase
      .from('coach_announcements')
      .insert({ coach_id: cloudUserIdRef.current, text });
    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        toast.error('You\'ve reached the announcement limit (20 per hour). Please try again later.');
      } else {
        toast.error('Failed to post announcement. Please try again.');
        if (import.meta.env.DEV) console.warn('[announcements] post error:', error.message);
      }
      captureError(error, { context: 'handlePostAnnouncement' });
      return;
    }
    toast.success('Announcement posted!', 2000);
    await fetchAnnouncements(cloudUserIdRef.current);
  }, [fetchAnnouncements]);

  /** Delete an announcement. */
  const handleDeleteAnnouncement = useCallback(async (id: string) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const { error } = await supabase.from('coach_announcements').delete().eq('id', id);
    if (error) { if (import.meta.env.DEV) console.warn('[announcements] delete error:', error.message); return; }
    setLiveAnnouncements(prev => prev.filter(a => a.id !== id));
  }, []);

  /** Fetch announcements from the player's coach (for the player dashboard).
   * REQUIRES RLS POLICY: coach_announcements must be scoped to the player's coach_id via squad membership.
   * See Supabase migrations for RLS setup.
   */
  const fetchPlayerCoachAnnouncements = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('coach_announcements')
        .select('id, text, created_at')
        // Note: coach_id filter is enforced via RLS policy, not here
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) { if (import.meta.env.DEV) console.warn('[announcements] player fetch error:', error.message); return; }
      const fmt = (iso: string) => {
        const d = new Date(iso); const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      };
      setPlayerCoachAnnouncements((data ?? []).map((r: { id: string; text: string; created_at: string }) => ({
        id: r.id, text: r.text, date: fmt(r.created_at),
      })));
    } catch (e) { if (import.meta.env.DEV) console.warn('[announcements] player fetch threw:', e); }
  }, []);

  // Fetch coach announcements for player when authenticated as a personal account
  useEffect(() => {
    const acct = store.userProfile?.accountType;
    if (acct === 'personal' && isAuthenticated) void fetchPlayerCoachAnnouncements();
  }, [isAuthenticated, store.userProfile?.accountType, fetchPlayerCoachAnnouncements]);

  // ---- Squad profile ----
  const fetchSquadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('player_profiles').select('display_name, position, jersey_number').eq('player_id', userId).single();
    if (data) setSquadProfile({ displayName: data.display_name, position: data.position, jerseyNumber: data.jersey_number });
    else setSquadProfile({ displayName: '', position: '', jerseyNumber: null });
  }, []);

  const handleSaveSquadProfile = useCallback(async (displayName: string, position: string, jerseyNumber: number | null) => {
    if (!supabase || !cloudUserIdRef.current) return;
    await supabase.from('player_profiles').upsert(
      { player_id: cloudUserIdRef.current, display_name: displayName, position, jersey_number: jerseyNumber, updated_at: new Date().toISOString() },
      { onConflict: 'player_id' }
    );
    setSquadProfile({ displayName, position, jerseyNumber });
  }, []);

  /** Save a coach's notes about a player. */
  const handleSavePlayerNote = useCallback(async (playerId: string, notes: string) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const { error } = await supabase
      .from('player_profiles')
      .update({ coach_notes: notes || null, updated_at: new Date().toISOString() })
      .eq('player_id', playerId);
    if (error) {
      toast.error('Failed to save notes. Please try again.');
      captureError(error, { context: 'handleSavePlayerNote', playerId });
      return;
    }
    toast.success('Notes saved!', 2000);
  }, [toast]);

  useEffect(() => {
    const acct = store.userProfile?.accountType;
    if (acct === 'personal' && isAuthenticated && cloudUserIdRef.current) void fetchSquadProfile(cloudUserIdRef.current);
  }, [isAuthenticated, store.userProfile?.accountType, fetchSquadProfile]);

  // ---- Schedule helpers ----
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

  /** Get the ISO date string (YYYY-MM-DD) for the Monday of the week containing `date`. */
  function getMondayOf(date: Date): string {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  /** Build an array of N week-start strings starting from this week's Monday. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function buildWeekStarts(n = 8): string[] {
    const base = new Date(getMondayOf(new Date()));
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      return d.toISOString().slice(0, 10);
    });
  }

  /** Format a week-start date into a human label like "2 – 8 Jun". */
  function formatWeekLabel(iso: string): string {
    const start = new Date(iso + 'T12:00:00');
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.toLocaleDateString('en-GB', opts)}`;
    }
    return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
  }

  /** Fetch the schedule rows for a coach and build ScheduleWeek objects. */
  const fetchSchedule = useCallback(async (userId: string) => {
    if (!supabase) return;
    const weekStarts = buildWeekStarts(8);
    try {
      const { data, error } = await supabase
        .from('coach_schedule')
        .select('week_start, day_of_week, type, label, description')
        .eq('coach_id', userId)
        .in('week_start', weekStarts);
      if (error) { if (import.meta.env.DEV) console.warn('[schedule] fetch error:', error.message); }
      // Build a lookup: weekStart → dayOfWeek → { type, label }
      const lookup: Record<string, Record<string, { type: string; label: string; description: string }>> = {};
      for (const row of (data ?? [])) {
        if (!lookup[row.week_start]) lookup[row.week_start] = {};
        lookup[row.week_start][row.day_of_week] = { type: row.type, label: row.label, description: row.description ?? '' };
      }
      const weeks = weekStarts.map((ws, i) => ({
        weekStart: ws,
        label: i === 0 ? 'This week' : i === 1 ? 'Next week' : formatWeekLabel(ws),
        phase: 'In-Season',
        days: DAYS.map(day => ({
          day,
          type: (lookup[ws]?.[day]?.type ?? 'rest') as 'rest' | 'training' | 'match',
          label: lookup[ws]?.[day]?.label ?? 'Rest',
          description: lookup[ws]?.[day]?.description ?? '',
        })),
      }));
      setLiveScheduleWeeks(weeks);
    } catch (e) { if (import.meta.env.DEV) console.warn('[schedule] fetch threw:', e); }
  }, []);

  /** Upsert a single day in the coach schedule. */
  const handleUpdateScheduleDay = useCallback(async (weekStart: string, day: string, type: 'rest' | 'training' | 'match', label: string, description: string) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const { error } = await supabase.from('coach_schedule').upsert(
      { coach_id: cloudUserIdRef.current, week_start: weekStart, day_of_week: day, type, label, description, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,week_start,day_of_week' }
    );
    if (error) { if (import.meta.env.DEV) console.warn('[schedule] upsert error:', error.message); return; }
    // Update local state immediately
    setLiveScheduleWeeks(prev => prev.map(w =>
      w.weekStart === weekStart
        ? { ...w, days: w.days.map(d => d.day === day ? { ...d, type, label, description } : d) }
        : w
    ));
  }, []);

  /** Fetch saved attendance records from Supabase. */
  const fetchAttendance = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('session_attendance').select('session_date, session_title, player_id, attended').eq('coach_id', userId).order('session_date', { ascending: false }).limit(1000);
      if (!Array.isArray(data)) return;
      // Group by (session_date, session_title)
      const grouped: Record<string, { session_date: string; session_title: string; attendance: Record<string, boolean> }> = {};
      for (const row of data) {
        const key = `${row.session_date}|${row.session_title}`;
        if (!grouped[key]) {
          grouped[key] = { session_date: row.session_date, session_title: row.session_title, attendance: {} };
        }
        grouped[key].attendance[row.player_id] = row.attended;
      }
      setSavedAttendance(Object.values(grouped));
    } catch (e) { if (import.meta.env.DEV) console.warn('[attendance] fetch error:', e); }
  }, []);

  // Fetch schedule, match results, and attendance when coach is authenticated
  useEffect(() => {
    const acct = store.userProfile?.accountType;
    if ((acct === 'coach' || acct === 'club') && isAuthenticated && cloudUserIdRef.current) {
      void fetchSchedule(cloudUserIdRef.current);
      void fetchMatchResults(cloudUserIdRef.current);
      void fetchAttendance(cloudUserIdRef.current);
    }
  }, [isAuthenticated, store.userProfile?.accountType, fetchSchedule, fetchAttendance]);

  // ---- Match results ----
  const fetchMatchResults = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('match_results').select('id, match_date, opponent, venue, goals_for, goals_against, notes').eq('coach_id', userId).order('match_date', { ascending: false }).limit(200);
    setMatchResults((data ?? []).map((r: { id: string; match_date: string; opponent: string; venue: string; goals_for: number; goals_against: number; notes: string }) => ({
      id: r.id, matchDate: r.match_date, opponent: r.opponent, venue: r.venue as 'home' | 'away',
      goalsFor: r.goals_for, goalsAgainst: r.goals_against, notes: r.notes,
    })));
  }, []);

  const handleSaveMatchResult = useCallback(async (result: Omit<MatchResult, 'id'>) => {
    if (!supabase || !cloudUserIdRef.current) return;
    // Prevent duplicate results for the same date
    const exists = matchResults.some(r => r.matchDate === result.matchDate);
    if (exists) {
      alert(`A result for ${result.matchDate} already exists. Use the Edit button to update it.`);
      return;
    }
    const { data, error } = await supabase.from('match_results').insert({
      coach_id: cloudUserIdRef.current, match_date: result.matchDate, opponent: result.opponent,
      venue: result.venue, goals_for: result.goalsFor, goals_against: result.goalsAgainst, notes: result.notes,
    }).select('id').single();
    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        toast.error('You\'ve reached the match result limit (50 per day). Please try again tomorrow.');
      } else {
        toast.error('Failed to save match result. Please try again.');
        if (import.meta.env.DEV) console.warn('[match results] save error:', error.message);
      }
      captureError(error, { context: 'handleSaveMatchResult' });
      return;
    }
    toast.success('Match result saved!', 2000);
    if (data) setMatchResults(prev => [{ ...result, id: data.id }, ...prev]);
  }, [matchResults]);

  const handleUpdateMatchResult = useCallback(async (result: MatchResult) => {
    if (!supabase || !result.id) return;
    const { error } = await supabase.from('match_results').update({
      match_date: result.matchDate, opponent: result.opponent, venue: result.venue,
      goals_for: result.goalsFor, goals_against: result.goalsAgainst, notes: result.notes,
    }).eq('id', result.id);
    if (!error) {
      setMatchResults(prev => prev.map(r => r.id === result.id ? result : r));
    }
  }, []);

  const handleDeleteMatchResult = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('match_results').delete().eq('id', id);
    if (!error) setMatchResults(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleSaveAttendance = useCallback(async (sessionDate: string, sessionTitle: string, attendance: Record<string, boolean>) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const coachId = cloudUserIdRef.current;
    const rows = Object.entries(attendance).map(([playerId, attended]) => ({
      coach_id: coachId, session_date: sessionDate, session_title: sessionTitle, player_id: playerId, attended,
    }));
    const { error: upsertError } = await supabase.from('session_attendance').upsert(rows, { onConflict: 'coach_id,session_date,player_id' });
    if (upsertError) {
      if (upsertError.message.includes('Rate limit exceeded')) {
        toast.error('You\'ve reached the attendance record limit (100 per day). Please try again tomorrow.');
      } else {
        toast.error('Failed to save attendance. Please try again.');
        if (import.meta.env.DEV) console.error('[attendance] save error:', upsertError);
      }
      captureError(upsertError, { context: 'handleSaveAttendance' });
      return;
    }
    toast.success('Attendance saved!', 2000);
    // Refresh the list
    try {
      await fetchAttendance(coachId);
    } catch (err) { if (import.meta.env.DEV) console.error('[attendance] refresh error:', err); }
  }, [fetchAttendance]);

  const handleSaveMatchSquad = useCallback(async (matchDate: string, squad: { playerId: string; role: 'starter' | 'sub' | 'unavailable'; position: string }[], formationData?: FormationData) => {
    if (!supabase || !cloudUserIdRef.current) return;
    const coachId = cloudUserIdRef.current;
    const rows = squad.map(s => ({ coach_id: coachId, match_date: matchDate, player_id: s.playerId, role: s.role, position: s.position, formation_data: formationData || null }));
    const { error } = await supabase.from('match_squads').upsert(rows, { onConflict: 'coach_id,match_date,player_id' });
    if (error) captureError(error, { context: 'handleSaveMatchSquad', matchDate });
  }, []);

  /** Fetch saved formation for a specific match. */
  const fetchSavedFormation = useCallback(async (matchDate: string) => {
    if (!supabase || !cloudUserIdRef.current) return null;
    const { data, error } = await supabase
      .from('match_squads')
      .select('formation_data')
      .eq('coach_id', cloudUserIdRef.current)
      .eq('match_date', matchDate)
      .limit(1)
      .single();
    if (error || !data?.formation_data) return null;
    return data.formation_data;
  }, []);

  /** Fetch the most recent saved formation from any previous match. */
  const fetchPreviousMatchFormation = useCallback(async () => {
    if (!supabase || !cloudUserIdRef.current) return null;
    const { data, error } = await supabase
      .from('match_squads')
      .select('formation_data')
      .eq('coach_id', cloudUserIdRef.current)
      .not('formation_data', 'is', null)
      .order('match_date', { ascending: false })
      .limit(1)
      .single();
    if (error || !data?.formation_data) return null;
    return data.formation_data;
  }, []);

  /** Post a squad notification as an announcement to all squad players. */
  const handleNotifySquad = useCallback(async (message: string) => {
    await handlePostAnnouncement(message);
  }, [handlePostAnnouncement]);

  const doGenerateProgramme = (resolvedInputs: ProgrammeInputs) => {
    const programme = generateProgramme(resolvedInputs);
    const todayStr = localDateStr(new Date());
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
    } catch (err) {
      captureError(err, { context: 'logout' });
      // logout proceeds regardless of cloud errors
    } finally {
      setSentryUser(null);
      // Clear the boot-sync guard so the next login re-fetches cloud data fresh.
      sessionStorage.removeItem('vf_boot_synced');
      // Wipe all local app data + the owner tag so the next account on this
      // (possibly shared) device starts clean and can't read the prior user's data.
      clearDataOwnership();
      // Detach the RevenueCat identity so iOS purchases don't carry to the next user.
      void rcLogOut();
      resetAnalyticsUser();
      cloudUserIdRef.current = null;
      setIsAuthenticated(false);
    }
  };


  // Email confirmation landing — user tapped the link in their email, now on the web app.
  // Show a simple "confirmed, go back to the app" screen instead of loading the dashboard.
  if (isEmailConfirmLanding) {
    return <EmailConfirmedLanding />;
  }

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

  // While checking for Supabase session, show a skeleton that matches the splash layout
  if (sessionChecking) {
    return <AppBootSkeleton />;
  }

  if (!store.userProfile) {
    return (
      <Onboarding
        // If already authenticated (e.g. login succeeded but profile wasn't in cloud),
        // pass the userId so Onboarding skips auth and goes straight to profile setup.
        existingUserId={isAuthenticated ? (cloudUserIdRef.current ?? undefined) : undefined}
        onComplete={(profile, planId, userId) => {
          if (userId) { identifyUser(userId, { position: profile.position }); setSentryUser(userId); }
          handleOnboardingComplete(profile, planId, userId);
          setIsAuthenticated(true);
        }}
        onLoginSuccess={(userId) => {
          if (userId) {
            cloudUserIdRef.current = userId;
            identifyUser(userId);
            setSentryUser(userId);
            // Re-sync premium state: cloudLoadData ran in Onboarding before this callback,
            // so localStorage now has the server-authoritative value — refresh React state.
            premium.refresh();
            rcConfigure(userId).then(() => premium.syncFromRC()).catch(() => {});
            void syncSquad(userId);
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoginSkeleton />}>
        <Login
          profile={store.userProfile}
          onLogin={(userId) => {
            if (userId) {
              cloudUserIdRef.current = userId;
              identifyUser(userId);
              // cloudLoadData ran in Login before this callback — re-sync premium state.
              premium.refresh();
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

  // Existing users who pre-date the terms update have no termsAcceptedAt.
  // Block the app until they accept — non-dismissable.
  if (!store.userProfile.termsAcceptedAt) {
    return (
      <TermsGateModal
        onAccept={() => {
          store.setUserProfile({ ...store.userProfile!, termsAcceptedAt: Date.now() });
        }}
      />
    );
  }

  const { screen } = nav;
  // Coach and Club accounts both use the squad dashboard (player-style nav hidden).
  const isClub = store.userProfile?.accountType === 'club';
  const isCoach = store.userProfile?.accountType === 'coach' || isClub;
  const fullScreens = ['testing-battery', 'programme-builder', 'generated-programme', 'paywall', 'active-workout'];
  const screenFallback = <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <CookieBanner />
      <Suspense fallback={screenFallback}>
      {screen === 'dashboard' && isCoach && (
        <CoachDashboard
          coachName={[store.userProfile.firstName, store.userProfile.lastName].filter(Boolean).join(' ')}
          inviteSeed={cloudUserIdRef.current ?? store.userProfile.email}
          players={[...liveSquadPlayers, ...DEMO_PLAYERS]}
          weeks={liveScheduleWeeks}
          teams={DEMO_TEAMS}
          announcements={liveAnnouncements}
          maxPlayers={isClub ? 200 : (premium.hasAccess ? 30 : 5)}
          isPaid={isClub || premium.hasAccess}
          onUpgrade={() => navigate({ screen: 'paywall' })}
          onOpenProfile={() => navigate({ screen: 'profile' })}
          onPostAnnouncement={handlePostAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onUpdateScheduleDay={handleUpdateScheduleDay}
          matchResults={matchResults}
          onSaveMatchResult={handleSaveMatchResult}
          savedAttendance={savedAttendance}
          onSaveAttendance={handleSaveAttendance}
          onSaveMatchSquad={handleSaveMatchSquad}
          onFetchSavedFormation={fetchSavedFormation}
          onFetchPreviousFormation={fetchPreviousMatchFormation}
          onUpdateMatchResult={handleUpdateMatchResult}
          onDeleteMatchResult={handleDeleteMatchResult}
          onNotifySquad={handleNotifySquad}
          onSavePlayerNote={handleSavePlayerNote}
        />
      )}
      {screen === 'dashboard' && !isCoach && (
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
          onDeleteSession={(id) => { store.deleteSession(id); }}
          referralCode={myReferralCode}
          cloudUnlinked={isSupabaseConfigured && !cloudUserIdRef.current}
          coachAnnouncements={playerCoachAnnouncements}
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
          matchEntries={store.matchEntries}
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
            startTransition(() => store.clearAll());
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
          onManageSubscription={premium.hasAccess ? async () => {
            if (Capacitor.isNativePlatform()) {
              // iOS: open Apple subscription management page
              window.open('https://apps.apple.com/account/subscriptions', '_system');
            } else {
              // Web: open Stripe customer portal
              const result = await createStripePortalSession();
              if ('url' in result) {
                window.location.href = result.url;
              } else {
                alert(result.error ?? 'Could not open subscription management. Please try again.');
              }
            }
          } : undefined}
          squadProfile={store.userProfile?.accountType === 'personal' ? squadProfile : undefined}
          onSaveSquadProfile={store.userProfile?.accountType === 'personal' ? handleSaveSquadProfile : undefined}
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
          pendingEmailConfirm={pendingEmailConfirm}
          accountType={store.userProfile?.accountType ?? 'personal'}
          onChangeAccountType={(type) => {
            if (store.userProfile) store.setUserProfile({ ...store.userProfile, accountType: type });
          }}
          trialDaysLeft={premium.trialDaysLeft}
          isTrialExpired={premium.isTrialExpired}
          purchasing={premium.purchasing || stripeCheckoutPending}
          restoring={premium.restoring}
          purchaseError={premium.purchaseError}
          onStartTrial={async (plan) => {
            // Coaches land on their squad dashboard; players go to the programme builder.
            const dest = isCoach ? 'dashboard' : 'programme-builder';
            if (Capacitor.isNativePlatform()) {
              // iOS: trial must go through StoreKit via RevenueCat
              const ok = await premium.purchase(plan);
              if (ok) {
                if (isCoach && cloudUserIdRef.current) await registerSquad(cloudUserIdRef.current);
                navigate({ screen: dest });
              }
            } else {
              // Web: local 14-day trial clock, no payment required up front
              premium.startTrial();
              if (isCoach && cloudUserIdRef.current) await registerSquad(cloudUserIdRef.current);
              navigate({ screen: dest });
            }
          }}
          onSelectPlan={async (plan, noTrial) => {
            if (!Capacitor.isNativePlatform()) {
              setStripeCheckoutPending(true);
              sessionStorage.setItem('vf_stripe_plan', plan);
              const acctType = store.userProfile?.accountType ?? 'personal';
              const result = await createStripeCheckout(plan, noTrial, acctType);
              if ('url' in result) {
                window.location.href = result.url;
                // Don't clear pending — the page is navigating away.
              } else {
                setStripeCheckoutPending(false);
                premium.setPurchaseError(result.error ?? 'Could not start checkout. Please try again.');
              }
              return;
            }
            const ok = await premium.purchase(plan);
            if (ok) {
              if (isCoach && cloudUserIdRef.current) await registerSquad(cloudUserIdRef.current);
              navigate({ screen: isCoach ? 'dashboard' : 'programme-builder' });
            }
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
            if (!cloudUserIdRef.current) {
              return 'Sign in to your account before redeeming a referral code.';
            }
            const err = await premium.redeemReferral(code, cloudUserIdRef.current);
            if (!err) setTimeout(() => navigate({ screen: 'programme-builder' }), REFERRAL_REDIRECT_DELAY_MS);
            return err;
          }}
          onDismiss={() => {
            // Coaches always return to their squad dashboard.
            if (isCoach) {
              navigate({ screen: 'dashboard' });
              return;
            }
            // If new user (no sessions yet) coming from onboarding, go to dashboard + show welcome
            if (!store.sessions.length && !store.generatedProgrammes.length) {
              navigate({ screen: 'dashboard' });
              setShowProgrammePrompt(true);
            } else {
              navigate({ screen: 'plans' });
            }
          }}
          onContinueFree={() => {
            // Dismiss paywall without granting access — paywall will re-appear on next gated tap
            navigate({ screen: 'dashboard' });
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

      {!fullScreens.includes(screen) && !isCoach && (
        <Navigation current={screen} onNavigate={s => navigate({ screen: s })} />
      )}

      {squadJoinToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[210] px-4 w-full max-w-sm" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}>
          <div
            className={`rounded-2xl px-4 py-3 shadow-lg text-sm font-medium flex items-center justify-between gap-3 ${
              squadJoinToast === 'pro' ? 'bg-green-600 text-white'
                : squadJoinToast === 'free' ? 'bg-gray-800 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <span>
              {squadJoinToast === 'pro' ? "You've joined the squad — Premium unlocked, free!"
                : squadJoinToast === 'free' ? "You've joined the squad. Ask your coach to upgrade for free Premium."
                : "That team code wasn't valid — you can add one later in settings."}
            </span>
            <button onClick={() => setSquadJoinToast(null)} className="text-white/80 hover:text-white flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {showSquadEnded && !isCoach && (
        <SquadEndedModal
          onKeepPremium={() => {
            try { localStorage.removeItem('vf_squad_ended'); } catch { /* ignore */ }
            setShowSquadEnded(false);
            navigate({ screen: 'paywall' });
          }}
          onDismiss={() => {
            try { localStorage.removeItem('vf_squad_ended'); } catch { /* ignore */ }
            setShowSquadEnded(false);
          }}
        />
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
            {pendingReTestSession.grades && Object.keys(pendingReTestSession.grades).length > 0 && (() => {
              const reTestNotes = buildTestEmphasis(pendingReTestSession.grades).coachNotes;
              return (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-1.5">What will change:</p>
                  {reTestNotes.length > 0
                    ? reTestNotes.map((note, i) => (
                        <p key={i} className="text-xs text-blue-600 leading-relaxed mb-1">• {note}</p>
                      ))
                    : <p className="text-xs text-blue-500 italic">Your grades are good — no major adjustments needed. Standard plan continues.</p>
                  }
                </div>
              );
            })()}
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
            {(() => {
              const testNotes = buildTestEmphasis(pendingTestGrades).coachNotes;
              return (
                <div className="mb-4 p-3 bg-brand-50 rounded-xl border border-brand-200">
                  <p className="text-xs font-semibold text-brand-700 mb-1.5">What will be adjusted:</p>
                  {testNotes.length > 0
                    ? testNotes.map((note, i) => (
                        <p key={i} className="text-xs text-brand-600 leading-relaxed mb-1">• {note}</p>
                      ))
                    : <p className="text-xs text-brand-500 italic">Your grades are strong — no major adjustments needed.</p>
                  }
                </div>
              );
            })()}
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
          const anchorDate = prog.programmeStartDate ?? localDateStr(new Date(prog.createdAt));
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
              <p className="text-center text-xs text-gray-400 mt-2">No payment required · from £6.67/mo after trial</p>
            </div>
          </div>
        </div>
      )}
      </Suspense>

      {/* Toast notifications */}
      <ToastContainer toasts={store.toasts} onDismiss={store.removeToast} />
    </div>
  );
}
