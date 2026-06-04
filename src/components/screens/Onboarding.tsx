import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ChevronRight, ChevronLeft, Dumbbell, Eye, EyeOff, Check, LogIn, UserPlus, Mail, Building2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { UserProfile } from '../../types';
import { isSupabaseConfigured, cloudSignUp, cloudSignIn, cloudSaveData, cloudLoadData, cloudSignOut, cloudResetPassword, cloudResendConfirmation } from '../../lib/cloudSync';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { hashPassword } from '../../lib/authUtils';
import { validateEmail, sanitiseTeamCode, EMAIL_MAX, PASSWORD_MAX, TEAM_CODE_MAX } from '../../lib/validation';

interface OnboardingProps {
  onComplete: (profile: UserProfile, recommendedPlanId: string, userId?: string) => void;
  onLoginSuccess?: (userId?: string) => void;
  /** When set, the user is already authenticated — skip auth step, go straight to profile setup */
  existingUserId?: string;
}

const GENDERS = [
  { id: 'male',   label: 'Male'   },
  { id: 'female', label: 'Female' },
  { id: 'other',  label: 'Other'  },
] as const;

function inputClass(hasError = false) {
  return `w-full px-4 py-3 rounded-xl border ${hasError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'} bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`;
}

function Label({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
      {children}
    </label>
  );
}

// Total wizard steps (excluding welcome): steps 1, 2, 3, 4, 5
const TOTAL_STEPS = 5;

const POSITIONS = [
  { id: 'GK', label: '🧤 Goalkeeper' },
  { id: 'CB', label: '🛡️ Centre Back' },
  { id: 'FB', label: '⚡ Full Back' },
  { id: 'CM', label: '⚙️ Midfielder' },
  { id: 'W',  label: '💨 Winger' },
  { id: 'ST', label: '🎯 Striker' },
] as const;

const EXPERIENCE_OPTIONS = [
  { id: '<1',  label: 'Less than 1 year' },
  { id: '1-3', label: '1–3 years' },
  { id: '3-5', label: '3–5 years' },
  { id: '5+',  label: '5+ years' },
] as const;

const FREQUENCY_OPTIONS = [
  { id: '0',   label: 'Just starting' },
  { id: '1-2', label: '1–2 per week' },
  { id: '3-4', label: '3–4 per week' },
  { id: '5+',  label: '5+ per week' },
] as const;

const GYM_ACCESS_OPTIONS = [
  { id: 'full',  label: '🏋️ Full gym' },
  { id: 'basic', label: '🪑 Basic gym' },
  { id: 'none',  label: '🌳 Home / Outdoor' },
] as const;

export function Onboarding({ onComplete, onLoginSuccess, existingUserId }: OnboardingProps) {
  // step: 0 = landing, -1 = login mode, 1 = create account, 2 = body metrics, 3 = training profile
  // If existingUserId is provided, skip landing and go straight to profile setup
  const [step, setStep] = useState(existingUserId ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Shown after sign-up when Supabase requires email confirmation before issuing a session
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  // True once cloudSignUp has been called — prevents re-calling handleEnterApp
  // if the user presses back from the confirmation screen and then tries to continue again.
  const [hasSignedUp, setHasSignedUp] = useState(false);
  const [pendingOnComplete, setPendingOnComplete] = useState<(() => void) | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Analytics: fire once when the user first lands in the onboarding flow
  useEffect(() => { trackEvent('onboarding_started'); }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  // Listen for email confirmation — when Supabase fires SIGNED_IN after the user
  // clicks the confirmation link, proceed with onboarding completion.
  useEffect(() => {
    if (!awaitingEmailConfirm || !supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && pendingOnComplete) {
        setAwaitingEmailConfirm(false);
        pendingOnComplete();
      }
    });
    return () => subscription.unsubscribe();
  }, [awaitingEmailConfirm, pendingOnComplete]);

  // Login mode state (step -1)
  const [loginEmail,      setLoginEmail]      = useState('');
  const [loginPassword,   setLoginPassword]   = useState('');
  const [showLoginPw,     setShowLoginPw]     = useState(false);
  const [loginError,      setLoginError]      = useState('');
  const [loginLoading,    setLoginLoading]    = useState(false);
  const [restoreSuccess,  setRestoreSuccess]  = useState('');

  // Forgot password state
  const [showForgot,     setShowForgot]     = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState('');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotSent,     setForgotSent]     = useState(false);
  const [forgotError,    setForgotError]    = useState('');

  // Step 1 — Account
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]         = useState('');
  const [email,           setEmail]            = useState('');
  const [password,        setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [showPassword,    setShowPassword]     = useState(false);
  const [showConfirm,     setShowConfirm]      = useState(false);

  // Step 2 — Age verification + Terms
  const [dobDay,         setDobDay]         = useState('');
  const [dobMonth,       setDobMonth]       = useState('');
  const [dobYear,        setDobYear]        = useState('');
  const dobDayRef   = useRef<HTMLInputElement>(null);
  const dobMonthRef = useRef<HTMLInputElement>(null);
  const dobYearRef  = useRef<HTMLInputElement>(null);
  const [agreedToTerms,  setAgreedToTerms]  = useState(false);
  const [parentalConsent,setParentalConsent]= useState(false);

  // Step 3 — Body metrics (optional)
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs' | 'st'>('kg');
  const [heightStr, setHeightStr] = useState('');
  const [heightInStr, setHeightInStr] = useState('');   // inches part when ft selected
  const [weightStr, setWeightStr] = useState('');
  const [weightStoneStr, setWeightStoneStr] = useState(''); // lbs part when st selected
  const [gender,    setGender]    = useState<'male' | 'female' | 'other' | ''>('');

  // Step 4 — Training profile (nothing pre-selected)
  const [position,        setPosition]        = useState<'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST' | ''>('');
  const [secondaryPos,    setSecondaryPos]    = useState<'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST' | ''>('');
  const [experienceYears, setExperienceYears] = useState<'<1' | '1-3' | '3-5' | '5+' | ''>('');
  const [gymFrequency,    setGymFrequency]    = useState<'0' | '1-2' | '3-4' | '5+' | ''>('');
  const [gymAccess,       setGymAccess]       = useState<'full' | 'basic' | 'none' | ''>('');
  const canEnterApp = position !== '' && experienceYears !== '' && gymFrequency !== '' && gymAccess !== '';

  // Step 3 — Account type (Personal / Coach / Club). Defaults to personal.
  const [accountType, setAccountType] = useState<'personal' | 'coach' | 'club'>('personal');
  // Optional squad invite code (personal players joining a coach/club).
  const [teamCode, setTeamCode] = useState('');

  // Age computation from DOB inputs
  const computedAge: number | null = (() => {
    const d = parseInt(dobDay, 10);
    const m = parseInt(dobMonth, 10);
    const y = parseInt(dobYear, 10);
    if (!d || !m || !y || dobYear.length !== 4) return null;
    const birth = new Date(y, m - 1, d);
    // Reject invalid dates (e.g. Feb 30)
    if (isNaN(birth.getTime()) || birth.getMonth() !== m - 1) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 && age <= 120 ? age : null;
  })();
  const dobString = (computedAge !== null && dobYear.length === 4)
    ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
    : undefined;
  const isUnderThirteen  = computedAge !== null && computedAge < 13;
  const needsParental    = computedAge !== null && computedAge >= 13 && computedAge < 16;
  // DOB is optional (Apple guideline 5.1.1v) — users may skip it.
  // If entered, age must be 13+ and parental consent given if 13–15.
  const canProceedFromAgeTerms =
    !isUnderThirteen &&
    agreedToTerms &&
    (!needsParental || parentalConsent);

  const heightCm: number | undefined = (() => {
    if (!heightStr) return undefined;
    if (heightUnit === 'cm') return parseFloat(heightStr) || undefined;
    const ft = parseFloat(heightStr) || 0;
    const inch = parseFloat(heightInStr) || 0;
    const total = ft * 12 + inch;
    return total > 0 ? Math.round(total * 2.54) : undefined;
  })();

  const weightKg: number | undefined = (() => {
    if (!weightStr) return undefined;
    const v = parseFloat(weightStr) || 0;
    if (weightUnit === 'kg') return v || undefined;
    if (weightUnit === 'lbs') return v > 0 ? Math.round(v * 0.453592 * 10) / 10 : undefined;
    // stone + lbs
    const lbs = parseFloat(weightStoneStr) || 0;
    const total = v * 14 + lbs;
    return total > 0 ? Math.round(total * 0.453592 * 10) / 10 : undefined;
  })();

  const passwordStrong = password.length >= 8 && password.length <= PASSWORD_MAX;
  const passwordsMatch = password === confirmPassword && confirmPassword !== '';
  const canCreateAccount = existingUserId
    ? firstName.trim() !== '' && lastName.trim() !== '' && validateEmail(email).ok
    : firstName.trim() !== '' && lastName.trim() !== '' && validateEmail(email).ok && passwordStrong && passwordsMatch;

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      if (isSupabaseConfigured) {
        let userId: string;
        try {
          userId = await cloudSignIn(loginEmail.trim().toLowerCase(), loginPassword);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('too_many_attempts')) {
            setLoginError('Too many attempts. Please wait 15 minutes before trying again.');
          } else if (msg.includes('Invalid login credentials') || msg.includes('invalid')) {
            setLoginError('Email or password is incorrect.');
          } else {
            setLoginError('Sign in failed. Check your connection and try again.');
          }
          setLoginLoading(false);
          return;
        }

        // Try to load data from cloud
        const loaded = await cloudLoadData(userId);

        if (loaded) {
          // cloudLoadData fires 'vf-cloud-restored' — all useLocalStorage hooks
          // re-read from localStorage so no page reload is needed
          setRestoreSuccess('Signed in! Loading your data…');
        } else {
          // No cloud data for this account. Check for valid local profile.
          let localProfile: { email?: string } | null = null;
          try {
            const raw = localStorage.getItem('vf_user_profile');
            localProfile = raw ? JSON.parse(raw) : null;
          } catch { /* ignore */ }

          if (localProfile && typeof localProfile === 'object' && localProfile.email) {
            // Has valid local data (e.g. offline mode / sync failed) — proceed
            await cloudSaveData(userId);
            onLoginSuccess?.(userId);
          } else {
            // Signed in to Supabase but zero data exists — account was deleted.
            await cloudSignOut();
            setLoginError('No account found for this email. Please create a new account.');
          }
        }
        setLoginLoading(false);
        return;
      }

      const raw = localStorage.getItem('vf_user_profile');
      const profile: UserProfile | null = raw ? JSON.parse(raw) : null;

      if (!profile || typeof profile !== 'object' || !profile.email) {
        setLoginError('No account found on this device. Please create a new account.');
        setLoginLoading(false);
        return;
      }

      if (profile.email.toLowerCase() !== loginEmail.trim().toLowerCase()) {
        setLoginError('Email or password is incorrect.');
        setLoginLoading(false);
        return;
      }

      if (profile.passwordHash) {
        const entered = await hashPassword(loginPassword, loginEmail.trim().toLowerCase());
        if (entered !== profile.passwordHash) {
          setLoginError('Email or password is incorrect.');
          setLoginLoading(false);
          return;
        }
      }

      onLoginSuccess?.();
    } catch {
      setLoginError('Unable to sign in. Check your connection and try again.');
    }
    setLoginLoading(false);
  };


  const handleCreateAccount = async () => {
    if (!canCreateAccount) return;
    setStep(2);
  };

  const handleEnterApp = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Only hash a password for the local-auth fallback path (Supabase not configured).
      // When Supabase is configured it handles authentication server-side — storing a
      // SHA-256 hash locally would be a weak-hash artefact with no purpose.
      const passwordHash = (existingUserId || isSupabaseConfigured)
        ? undefined
        : await hashPassword(password, email.trim().toLowerCase());
      const profile: UserProfile = {
        firstName:       firstName.trim(),
        lastName:        lastName.trim(),
        email:           email.trim().toLowerCase(),
        passwordHash,
        position:          position as 'GK' | 'CB' | 'FB' | 'CM' | 'W' | 'ST',
        secondaryPosition: secondaryPos || undefined,
        experienceYears:   experienceYears as '<1' | '1-3' | '3-5' | '5+',
        gymFrequency:      gymFrequency as '0' | '1-2' | '3-4' | '5+',
        goals:             [],
        gymAccess:         gymAccess as 'full' | 'basic' | 'none',
        completedAt:     Date.now(),
        heightCm,
        weightKg,
        gender:          gender || undefined,
        dateOfBirth:     dobString,
        termsAcceptedAt: Date.now(),
        accountType,
      };

      // Write profile directly to localStorage NOW so cloudSaveData always finds it,
      // regardless of whether React's useEffect has committed yet.
      localStorage.setItem('vf_user_profile', JSON.stringify(profile));

      // Stash a pending squad code so App can join once the player is authenticated
      // (handles the email-confirmation delay — join happens on first real session).
      if (accountType === 'personal' && teamCode.trim()) {
        localStorage.setItem('vf_pending_team_code', teamCode.trim().toUpperCase());
      }

      let userId: string | undefined = existingUserId;
      let needsConfirmation = false;
      if (!userId && isSupabaseConfigured) {
        try {
          const result = await cloudSignUp(profile.email, password);
          if (result.userId) userId = result.userId;
          needsConfirmation = result.needsEmailConfirmation;
        } catch (err: unknown) {
          // If account already exists in Supabase, try signing in instead
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('already registered') || msg.includes('already exists')) {
            try {
              const id = await cloudSignIn(profile.email, password);
              if (id) userId = id;
              needsConfirmation = false;
            } catch { /* fall through to local-only */ }
          }
        }
      }

      // Fail closed: with Supabase configured, never proceed into the app as a
      // local-only "authenticated" session if sign-up AND sign-in both failed.
      // (Previously this fell through to onComplete with userId=undefined.)
      if (isSupabaseConfigured && !userId && !needsConfirmation) {
        setSubmitError('Could not create your account. Please check your connection and try again.');
        return;
      }

      // Push data to cloud immediately (profile is already in localStorage above)
      if (userId) {
        await cloudSaveData(userId);
      }

      if (needsConfirmation) {
        // Block here — show "check your email" screen and wait for SIGNED_IN event
        const proceed = () => onComplete(profile, '', userId);
        setPendingOnComplete(() => proceed);
        setHasSignedUp(true);
        setAwaitingEmailConfirm(true);
        return;
      }

      // No plan pre-selected during onboarding — paywall shown immediately after
      onComplete(profile, '', userId);
    } finally {
      setSubmitting(false);
    }
  };

  // Coach/Club finish at step 3 (no body metrics / training profile), so the bar fills over 3 steps.
  const effectiveTotal = accountType !== 'personal' ? 3 : TOTAL_STEPS;
  const progressPct = step <= 0 ? 0 : (step / effectiveTotal) * 100;

  // Blocking email confirmation screen — shown after sign-up until user confirms their email
  if (awaitingEmailConfirm) {
    const handleConfirmedEmail = async () => {
      setConfirmError('');
      setConfirmLoading(true);
      try {
        const userId = await cloudSignIn(email.trim().toLowerCase(), password);
        // Sign-in succeeded — email is confirmed
        setAwaitingEmailConfirm(false);
        if (pendingOnComplete) pendingOnComplete();
        else if (userId) onComplete({ firstName, lastName, email: email.trim().toLowerCase() } as Parameters<typeof onComplete>[0], '', userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
          setConfirmError('Email not confirmed yet. Please tap the link in your inbox first.');
        } else {
          setConfirmError('Could not sign in. Check your connection and try again.');
        }
      } finally {
        setConfirmLoading(false);
      }
    };

    const handleResend = async () => {
      setResendLoading(true);
      setResendSent(false);
      try {
        await cloudResendConfirmation(email.trim().toLowerCase());
        setResendSent(true);
      } catch {
        // silent — user can try again
      } finally {
        setResendLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h2>
        <p className="text-gray-500 text-sm mb-2">We've sent a confirmation link to:</p>
        <p className="text-brand-600 font-semibold text-sm mb-6">{email}</p>
        <p className="text-gray-400 text-xs max-w-xs mb-8">
          Tap the link in the email, then come back here and tap the button below.
        </p>

        <button
          onClick={handleConfirmedEmail}
          disabled={confirmLoading}
          className="w-full max-w-xs py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg disabled:opacity-50 mb-3"
        >
          {confirmLoading ? 'Checking…' : "I've confirmed my email"}
        </button>

        {confirmError && (
          <p className="text-red-500 text-xs mb-3 max-w-xs">{confirmError}</p>
        )}

        <button
          onClick={() => {
            // On iOS open the native Mail app; fallback to mailto: on web
            const url = Capacitor.isNativePlatform() ? 'message://' : 'mailto:';
            window.open(url, '_system');
          }}
          className="w-full max-w-xs flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors mb-3"
        >
          <Mail size={16} />
          Open Mail App
        </button>

        <button
          onClick={handleResend}
          disabled={resendLoading || resendSent}
          className="text-xs text-brand-500 underline disabled:opacity-50"
        >
          {resendSent ? 'Email resent! Check your inbox.' : resendLoading ? 'Sending…' : "Didn't get it? Resend email"}
        </button>

        <p className="mt-4 text-xs text-gray-400">Can't find it? Check your spam folder.</p>

        <button
          onClick={() => { setAwaitingEmailConfirm(false); setStep(3); }}
          className="mt-6 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={14} /> Edit my details
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-5">

        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center items-center text-center py-16">
            <img src="/icon-512.png" alt="Vector Football" className="w-20 h-20 rounded-3xl mb-6 shadow-lg" />
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Vector Football</h1>
            <p className="text-gray-500 text-base mb-10 max-w-xs leading-relaxed">
              Elite football strength and conditioning, personalised to your match schedule and readiness.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-500 text-white font-bold text-base hover:bg-brand-600 transition-colors shadow-lg"
              >
                <UserPlus size={18} />
                Create Account
              </button>
              <button
                onClick={() => { setLoginError(''); setStep(-1); }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-bold text-base hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <LogIn size={18} />
                Log In
              </button>
            </div>
          </div>
        )}

        {step === -1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-7">Sign in to your account.</p>

            <div className="flex flex-col gap-4">
              <div>
                <Label>Email Address</Label>
                <input
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setLoginError(''); }}
                  type="email"
                  placeholder="you@example.com"
                  style={{ fontSize: '16px' }}
                  className={inputClass()}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label>Password</Label>
                <div className="relative">
                  <input
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); setLoginError(''); }}
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="Your password"
                    style={{ fontSize: '16px' }}
                    className={inputClass()}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{loginError}</p>
                  {loginError.includes('No account') && (
                    <button
                      onClick={() => { setStep(1); setLoginError(''); }}
                      className="mt-2 text-sm font-semibold text-brand-600 underline"
                    >
                      Create a new account →
                    </button>
                  )}
                </div>
              )}
            </div>

            {restoreSuccess && (
              <div className="flex items-center gap-2 mt-3 text-green-600 text-sm font-semibold">
                <Check size={14} /> {restoreSuccess}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                  loginLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                }`}
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
                {!loginLoading && <ChevronRight size={16} />}
              </button>
            </div>

            {isSupabaseConfigured && !showForgot && (
              <button
                onClick={() => { setShowForgot(true); setForgotEmail(loginEmail); setForgotError(''); setForgotSent(false); }}
                className="w-full mt-3 text-sm text-brand-500 hover:text-brand-600 text-center py-2 font-semibold"
              >
                Forgot password?
              </button>
            )}

            {isSupabaseConfigured && showForgot && (
              <div className="mt-4 p-4 rounded-xl bg-gray-100 border border-gray-200">
                {forgotSent ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                    <Check size={14} /> Reset link sent — check your inbox.
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-3 font-semibold">Send password reset email</p>
                    <input
                      value={forgotEmail}
                      onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                      type="email"
                      placeholder="your@email.com"
                      style={{ fontSize: '16px' }}
                      className={inputClass(!!forgotError)}
                    />
                    {forgotError && <p className="text-xs text-red-500 mt-1">{forgotError}</p>}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setShowForgot(false)}
                        className="px-3 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!forgotEmail || forgotLoading) return;
                          setForgotLoading(true);
                          setForgotError('');
                          try {
                            await cloudResetPassword(forgotEmail);
                            setForgotSent(true);
                          } catch {
                            setForgotError('Could not send reset email. Check the address.');
                          }
                          setForgotLoading(false);
                        }}
                        disabled={!forgotEmail || forgotLoading}
                        className="flex-1 py-2 rounded-lg text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400"
                      >
                        {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 1 of 5</p>
            {existingUserId ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Set up your profile</h2>
                <p className="text-gray-500 text-sm mb-7">You're signed in — just fill in your details to get started.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
                <p className="text-gray-500 text-sm mb-7">Your details are stored securely on this device.</p>
              </>
            )}

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="First name"
                    maxLength={50}
                    style={{ fontSize: '16px' }}
                    className={inputClass(!firstName.trim() && firstName !== '')}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label>Surname</Label>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Last name"
                    maxLength={50}
                    style={{ fontSize: '16px' }}
                    className={inputClass()}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <Label>Email Address</Label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  maxLength={EMAIL_MAX}
                  style={{ fontSize: '16px' }}
                  className={inputClass()}
                  autoComplete="email"
                />
              </div>

              {!existingUserId && (
                <>
                  <div>
                    <Label>Password</Label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={e => { setPassword(e.target.value); }}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        maxLength={PASSWORD_MAX}
                        style={{ fontSize: '16px' }}
                        className={inputClass(password !== '' && !passwordStrong)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password !== '' && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className={`h-1 flex-1 rounded-full transition-colors ${passwordStrong ? 'bg-green-400' : 'bg-red-300'}`} />
                        <span className={`text-xs font-medium ${passwordStrong ? 'text-green-600' : 'text-red-400'}`}>
                          {passwordStrong ? 'Strong enough' : 'Too short'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Confirm Password</Label>
                    <div className="relative">
                      <input
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); }}
                        type={showConfirm ? 'text' : 'password'}
                        style={{ fontSize: '16px' }}
                        placeholder="Re-enter password"
                        maxLength={PASSWORD_MAX}
                        className={inputClass(confirmPassword !== '' && !passwordsMatch)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {confirmPassword !== '' && passwordsMatch && (
                        <div className="absolute right-9 top-1/2 -translate-y-1/2 text-green-500">
                          <Check size={15} />
                        </div>
                      )}
                    </div>
                    {confirmPassword !== '' && !passwordsMatch && (
                      <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                    )}
                  </div>
                </>
              )}

            </div>

            {!existingUserId && (
              <p className="text-xs text-center text-gray-400 mt-5">
                Already have an account?{' '}
                <button onClick={() => { setLoginError(''); setStep(-1); }} className="text-brand-500 font-semibold underline">
                  Log in
                </button>
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 2 of 5</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Age &amp; Terms</h2>
            <p className="text-gray-500 text-sm mb-7">We need to verify your age and confirm you agree to our terms before you start.</p>

            {/* Date of birth */}
            <div className="mb-5">
              <Label>Date of Birth <span style={{fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem'}}>(optional)</span></Label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  ref={dobDayRef}
                  value={dobDay}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDobDay(val);
                    if (val.length === 2) dobMonthRef.current?.focus();
                  }}
                  placeholder="DD"
                  inputMode="numeric"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  ref={dobMonthRef}
                  value={dobMonth}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDobMonth(val);
                    if (val.length === 2) dobYearRef.current?.focus();
                  }}
                  placeholder="MM"
                  inputMode="numeric"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  ref={dobYearRef}
                  value={dobYear}
                  onChange={e => setDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="YYYY"
                  inputMode="numeric"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">Day &nbsp;/&nbsp; Month &nbsp;/&nbsp; Year</p>
            </div>

            {/* Under-13 block */}
            {isUnderThirteen && (
              <div className="flex gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 mb-4">
                <span className="text-red-500 text-base flex-shrink-0">✗</span>
                <p className="text-sm text-red-700 font-medium leading-snug">
                  You must be at least 13 years old to use Vector Football. This app is not available for users under 13.
                </p>
              </div>
            )}

            {/* 13–15: parental consent notice */}
            {needsParental && (
              <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                <span className="text-amber-500 text-base flex-shrink-0">ℹ</span>
                <p className="text-sm text-amber-700 leading-snug">
                  As you are under 16, a parent or guardian must read and agree to these terms on your behalf before you continue.
                </p>
              </div>
            )}

            {/* Terms checkboxes — shown unless user has confirmed they are under 13.
                DOB is optional (guideline 5.1.1v), so terms show immediately by default. */}
            {!isUnderThirteen && (
              <div className="flex flex-col gap-3">
                {needsParental && (
                  <label className="flex gap-3 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={parentalConsent}
                      onChange={e => setParentalConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 accent-brand-500 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-snug">
                      My parent or guardian has read and agreed to the{' '}
                      <button type="button" onClick={() => window.open('/terms/', '_blank')} className="text-brand-600 underline font-medium">Terms of Use</button>
                      {' '}and{' '}
                      <button type="button" onClick={() => window.open('/privacy/', '_blank')} className="text-brand-600 underline font-medium">Privacy Policy</button>
                      {' '}on my behalf.
                    </span>
                  </label>
                )}
                <label className="flex gap-3 items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 accent-brand-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 leading-snug">
                    {needsParental ? 'I confirm the above and ' : 'I '}agree to the{' '}
                    <button type="button" onClick={() => window.open('/terms/', '_blank')} className="text-brand-600 underline font-medium">Terms of Use</button>
                    {' '}and{' '}
                    <button type="button" onClick={() => window.open('/privacy/', '_blank')} className="text-brand-600 underline font-medium">Privacy Policy</button>.
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 4 of 5</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">About you</h2>
            <p className="text-gray-500 text-sm mb-7">Used to personalise your programme. All optional — you can add these later in Settings.</p>

            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Height <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                    {(['cm', 'ft'] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => { setHeightUnit(u); setHeightStr(''); setHeightInStr(''); }}
                        className={`px-2.5 py-1 transition-colors ${heightUnit === u ? 'bg-brand-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                {heightUnit === 'cm' ? (
                  <input
                    value={heightStr}
                    onChange={e => setHeightStr(e.target.value)}
                    type="number"
                    min="100" max="250"
                    placeholder="e.g. 180"
                    style={{ fontSize: '16px' }}
                    className={inputClass()}
                  />
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        value={heightStr}
                        onChange={e => setHeightStr(e.target.value)}
                        type="number"
                        min="4" max="8"
                        placeholder="5"
                        style={{ fontSize: '16px' }}
                        className={inputClass() + ' pr-8'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">ft</span>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        value={heightInStr}
                        onChange={e => setHeightInStr(e.target.value)}
                        type="number"
                        min="0" max="11"
                        placeholder="11"
                        style={{ fontSize: '16px' }}
                        className={inputClass() + ' pr-8'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">in</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Weight <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                    {(['kg', 'lbs', 'st'] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => { setWeightUnit(u); setWeightStr(''); setWeightStoneStr(''); }}
                        className={`px-2.5 py-1 transition-colors ${weightUnit === u ? 'bg-brand-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                {weightUnit === 'st' ? (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        value={weightStr}
                        onChange={e => setWeightStr(e.target.value)}
                        type="number"
                        min="4" max="30"
                        placeholder="11"
                        style={{ fontSize: '16px' }}
                        className={inputClass() + ' pr-8'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">st</span>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        value={weightStoneStr}
                        onChange={e => setWeightStoneStr(e.target.value)}
                        type="number"
                        min="0" max="13"
                        placeholder="0"
                        style={{ fontSize: '16px' }}
                        className={inputClass() + ' pr-8'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">lbs</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={weightStr}
                      onChange={e => setWeightStr(e.target.value)}
                      type="number"
                      min={weightUnit === 'kg' ? 30 : 66}
                      max={weightUnit === 'kg' ? 200 : 440}
                      placeholder={weightUnit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
                      style={{ fontSize: '16px' }}
                      className={inputClass() + ' pr-12'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">{weightUnit}</span>
                  </div>
                )}
              </div>

              <div>
                <Label>Gender <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                <div className="flex gap-2">
                  {GENDERS.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        gender === g.id
                          ? 'border-brand-500 bg-brand-50 text-brand-600'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (() => {
          const btnBase = 'py-2.5 rounded-xl text-sm font-semibold border transition-all text-center';
          const btnActive = 'bg-brand-500 text-white border-brand-500';
          const btnInactive = 'bg-white text-gray-600 border-gray-200 hover:border-brand-300';
          return (
            <div className="flex-1 flex flex-col py-12 pt-16">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 5 of 5</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Your training profile</h2>
              <p className="text-gray-500 text-sm mb-7">Helps us build the right programme for you.</p>

              <div className="flex flex-col gap-6">
                {/* Primary Position */}
                <div>
                  <Label>Playing Position</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITIONS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPosition(p.id as typeof position);
                          if (secondaryPos === p.id) setSecondaryPos('');
                        }}
                        className={`${btnBase} ${position === p.id ? btnActive : btnInactive}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secondary Position */}
                <div>
                  <Label>Secondary Position <span className="text-gray-400 normal-case font-normal">(optional)</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([{ id: '', label: '— None' }, ...POSITIONS] as { id: string; label: string }[]).map(p => {
                      const isNone = p.id === '';
                      const isSelected = !isNone && secondaryPos === p.id;
                      const isPrimary = !isNone && p.id === position;
                      const isNoneSelected = isNone && secondaryPos === '';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isPrimary}
                          onClick={() => !isPrimary && setSecondaryPos(p.id as typeof secondaryPos)}
                          className={`${btnBase} ${
                            isPrimary
                              ? 'opacity-30 border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isSelected
                              ? 'bg-purple-500 text-white border-purple-500'
                              : isNoneSelected
                              ? 'border-gray-400 bg-gray-100 text-gray-600'
                              : btnInactive
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <Label>Gym Training Experience</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPERIENCE_OPTIONS.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setExperienceYears(o.id as typeof experienceYears)}
                        className={`${btnBase} ${experienceYears === o.id ? btnActive : btnInactive}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gym frequency */}
                <div>
                  <Label>Current Gym Sessions per Week</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FREQUENCY_OPTIONS.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setGymFrequency(o.id as typeof gymFrequency)}
                        className={`${btnBase} ${gymFrequency === o.id ? btnActive : btnInactive}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment access */}
                <div>
                  <Label>Equipment Access</Label>
                  <div className="flex flex-col gap-2">
                    {GYM_ACCESS_OPTIONS.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setGymAccess(o.id as typeof gymAccess)}
                        className={`${btnBase} ${gymAccess === o.id ? btnActive : btnInactive}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {step === 3 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 3 of {accountType !== 'personal' ? '3' : '5'}</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose your account</h2>
            <p className="text-gray-500 text-sm mb-7">You can change this later in settings.</p>

            <div className="flex flex-col gap-4">
              {/* Personal */}
              <button
                type="button"
                onClick={() => setAccountType('personal')}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  accountType === 'personal'
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserPlus size={20} className="text-brand-500" />
                    <span className="text-lg font-bold text-gray-900">Personal</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    accountType === 'personal' ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                  }`}>
                    {accountType === 'personal' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Your own personalised training. Build programmes around your position, schedule and readiness — just for you.
                </p>
              </button>

              {/* Coach */}
              <button
                type="button"
                onClick={() => setAccountType('coach')}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  accountType === 'coach'
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={20} className="text-brand-500" />
                    <span className="text-lg font-bold text-gray-900">Coach</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    accountType === 'coach' ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                  }`}>
                    {accountType === 'coach' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  Manage up to <span className="font-semibold text-gray-800">30 players</span> on one account. Share an invite code, assign programmes, and track your whole squad's readiness and progress.
                </p>
                <div className="flex items-center gap-2 text-xs text-brand-600 font-medium bg-brand-100/60 rounded-lg px-3 py-2">
                  <span>Your players get full premium access included — they don't pay a penny.</span>
                </div>
              </button>

              {/* Club */}
              <button
                type="button"
                onClick={() => setAccountType('club')}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  accountType === 'club'
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-brand-500" />
                    <span className="text-lg font-bold text-gray-900">Club / Academy</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    accountType === 'club' ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                  }`}>
                    {accountType === 'club' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  One licence for your whole club. Multiple <span className="font-semibold text-gray-800">coaches and teams</span> under a single account — every player included.
                </p>
                <div className="flex items-center gap-2 text-xs text-brand-600 font-medium bg-brand-100/60 rounded-lg px-3 py-2">
                  <span>Best for academies — add coaches, manage age groups, one simple bill.</span>
                </div>
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-400 text-center">
              {accountType === 'coach'
                ? "You'll set up your squad and invite players after creating your account."
                : accountType === 'club'
                ? "You'll add your coaches and teams after creating your account."
                : 'Choose Coach or Club if you train a team and want everyone on one subscription.'}
            </p>

            {/* Optional squad invite code — players joining a coach/club */}
            {accountType === 'personal' && (
              <div className="mt-6">
                <Label>Team code <span className="text-gray-400 normal-case font-normal">(optional)</span></Label>
                <input
                  type="text"
                  value={teamCode}
                  onChange={e => setTeamCode(sanitiseTeamCode(e.target.value))}
                  placeholder="e.g. VF-K7M2P"
                  maxLength={TEAM_CODE_MAX}
                  style={{ fontSize: '16px' }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Got a code from your coach? Enter it to join their squad. If they're on the Pro plan, you'll get full Premium free.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex gap-3 py-6">
            {!existingUserId && (
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            <button
              onClick={handleCreateAccount}
              disabled={!canCreateAccount}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                canCreateAccount
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedFromAgeTerms}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                canProceedFromAgeTerms
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 3 — Account type. Personal continues to body metrics; Coach finishes here. */}
        {step === 3 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={() => {
                // If signup already happened (email confirmation pending), never re-call
                // handleEnterApp — just return to the confirmation screen. This prevents
                // the user bypassing email confirmation by going back and re-submitting.
                if (hasSignedUp) { setAwaitingEmailConfirm(true); return; }
                if (accountType !== 'personal') handleEnterApp(); else setStep(4);
              }}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                submitting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              }`}
            >
              {submitting
                ? 'Creating…'
                : hasSignedUp ? 'Back to email confirmation'
                : accountType === 'coach' ? 'Continue as Coach'
                : accountType === 'club' ? 'Continue as Club'
                : 'Continue'}
              {!submitting && <ChevronRight size={16} />}
            </button>
          </div>
        )}

        {/* Step 4 — Body metrics (personal only) */}
        {step === 4 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 5 — Training profile (personal only) */}
        {step === 5 && (
          <div className="flex gap-3 py-6">
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={handleEnterApp}
              disabled={submitting || !canEnterApp}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                submitting || !canEnterApp
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              }`}
            >
              {submitting ? 'Creating…' : 'Start Training'}
              {!submitting && <ChevronRight size={16} />}
            </button>
          </div>
        )}
        {submitError && (
          <p className="text-sm text-red-600 mt-3 text-center px-4">{submitError}</p>
        )}
      </div>
    </div>
  );
}
