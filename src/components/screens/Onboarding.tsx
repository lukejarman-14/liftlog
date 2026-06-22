import { useState, useEffect, type ReactNode } from 'react';
import DateScrollPicker from '../DateScrollPicker';
import { ChevronRight, ChevronLeft, Dumbbell, Eye, EyeOff, Check, LogIn, UserPlus, Mail, Building2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { UserProfile } from '../../types';
import { isSupabaseConfigured, cloudSignUp, cloudSignIn, cloudSaveData, cloudLoadData, cloudSignOut, cloudResetPassword, cloudResendConfirmation } from '../../lib/cloudSync';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { hashPassword } from '../../lib/authUtils';
import { validateDateOfBirth, validateEmail, sanitiseTeamCode, EMAIL_MAX, PASSWORD_MAX, TEAM_CODE_MAX } from '../../lib/validation';
import { signInWithApple, isAppleSignInAvailable, signInWithGoogle, isGoogleSignInAvailable } from '../../lib/socialAuth';
import { AppleSignInButton } from '../AppleSignInButton';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { activateAppReviewDemo, isAppReviewDemoLogin } from '../../lib/appReviewDemo';
import { activateDemoFilming, isDemoFilmingLogin } from '../../lib/demoFilming';
import { forgetRememberedLogin, rememberLogin } from '../../lib/authPersistence';
import { useActionCooldown } from '../../hooks/useActionCooldown';
import { OAuthButtons } from '../OAuthButtons';
import { OAUTH_ENABLED } from '../../lib/featureFlags';

interface OnboardingProps {
  onComplete: (profile: UserProfile, recommendedPlanId: string, userId?: string) => void;
  onLoginSuccess?: (userId?: string) => void;
  /** When set, the user is already authenticated — skip auth step, go straight to profile setup */
  existingUserId?: string;
  initialNotice?: string;
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

export function Onboarding({ onComplete, onLoginSuccess, existingUserId, initialNotice }: OnboardingProps) {
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
  // Inline "change email" on the confirmation screen — lets a user fix a mistyped
  // address and get a fresh confirmation email without re-walking onboarding. We
  // hold the built profile so its email can be updated in place.
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [changeEmailBusy, setChangeEmailBusy] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState('');
  const [changeEmailSent, setChangeEmailSent] = useState(false);

  // Social sign-in (Apple). When a new user authenticates via Apple, we hold their
  // Supabase user id here so the final step saves to that account instead of
  // creating a fresh email/password one — same mechanism as an injected existingUserId.
  const [socialUserId, setSocialUserId] = useState<string | undefined>(undefined);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError]   = useState('');

  // Analytics: fire once when the user first lands in the onboarding flow
  useEffect(() => { trackEvent('onboarding_started'); }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  useEffect(() => {
    const handleOnline = () => {
      setSubmitError(prev =>
        prev.toLowerCase().includes('connection') || prev.toLowerCase().includes('offline')
          ? ''
          : prev
      );
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

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
  const [stayLoggedIn,    setStayLoggedIn]    = useState(true);

  // Forgot password state
  const [showForgot,     setShowForgot]     = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState('');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotSent,     setForgotSent]     = useState(false);
  const [forgotError,    setForgotError]    = useState('');
  const forgotCooldown = useActionCooldown('password-reset', forgotEmail || loginEmail || 'unknown');

  // Step 1 — Account
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]         = useState('');
  const [email,           setEmail]            = useState('');
  const [password,        setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [showPassword,    setShowPassword]     = useState(false);
  const [showConfirm,     setShowConfirm]      = useState(false);
  const confirmEmailCooldown = useActionCooldown('email-confirm', email || 'unknown');

  // Step 2 — Age verification + Terms
  const [dobDay,         setDobDay]         = useState('01');
  const [dobMonth,       setDobMonth]       = useState('01');
  const [dobYear,        setDobYear]        = useState('2000');
  const [agreedToTerms,  setAgreedToTerms]  = useState(false);
  const [parentalConsent,setParentalConsent]= useState(false);
  const [dobTouched,     setDobTouched]     = useState(false);

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

  // Age computation from DOB inputs. DOB is OPTIONAL (App Store requirement) —
  // the picker shows a default date, so we only treat it as a real answer once
  // the user actually interacts with the wheels (dobTouched). If they never
  // touch it, no date of birth is recorded.
  const dobValidation = validateDateOfBirth(dobDay, dobMonth, dobYear);
  const hasDobInput = dobTouched;
  const computedAge = dobValidation.ok && dobTouched ? dobValidation.value.age : null;
  const isUnderThirteen  = computedAge !== null && computedAge < 13;
  const needsParental    = computedAge !== null && computedAge >= 13 && computedAge < 16;
  const dobError = !dobValidation.ok && hasDobInput ? dobValidation.error : '';
  // DOB is optional: an untouched picker is fine. But IF the user volunteers a
  // date it must be a real calendar date, age 13+, and have parental consent for 13–15
  // (we won't knowingly accept an under-13 sign-up).
  const canProceedFromAgeTerms =
    agreedToTerms &&
    (!dobTouched || (dobValidation.ok && !isUnderThirteen && (!needsParental || parentalConsent)));

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
  // A social-authenticated user (socialUserId) needs no password, same as a
  // coach-injected existingUserId — they only confirm name + email.
  const socialOrExisting = existingUserId || socialUserId;
  const canCreateAccount = socialOrExisting
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
      if (isAppReviewDemoLogin(loginEmail, loginPassword)) {
        activateAppReviewDemo();
        if (stayLoggedIn) rememberLogin(loginEmail);
        else forgetRememberedLogin();
        setRestoreSuccess('App Review demo mode unlocked.');
        onLoginSuccess?.();
        setLoginLoading(false);
        return;
      }

      if (isDemoFilmingLogin(loginEmail, loginPassword)) {
        activateDemoFilming();
        if (stayLoggedIn) rememberLogin(loginEmail);
        else forgetRememberedLogin();
        setRestoreSuccess('Demo filming mode unlocked.');
        onLoginSuccess?.();
        setLoginLoading(false);
        return;
      }

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
          if (stayLoggedIn) rememberLogin(loginEmail, userId);
          else forgetRememberedLogin();
          onLoginSuccess?.(userId);
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
            if (stayLoggedIn) rememberLogin(loginEmail, userId);
            else forgetRememberedLogin();
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

      if (stayLoggedIn) rememberLogin(loginEmail);
      else forgetRememberedLogin();
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

  const handleAppleSignIn = async () => {
    if (socialLoading) return;
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithApple();
      trackEvent('apple_sign_in');

      // Returning user — they already have an account; load their data and go in.
      const loaded = await cloudLoadData(result.userId);
      if (loaded) {
        onLoginSuccess?.(result.userId);
        return; // component unmounts — no state updates past here
      }

      // New user — pre-fill what Apple gave us (name/email only on first sign-in),
      // remember the authenticated id, then skip the email/password step and go
      // straight into the football questionnaire.
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName)  setLastName(result.lastName);
      if (result.email)     setEmail(result.email);
      setSocialUserId(result.userId);
      // Apple only returns a name on the FIRST authorisation ever. If we didn't
      // get one, send them to the name step so they're never left nameless;
      // otherwise skip straight to the questionnaire.
      setStep(result.firstName ? 2 : 1);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      // User-cancelled the Apple sheet — not an error worth surfacing.
      if (msg.includes('cancel') || msg.includes('1001') || msg.includes('popup_closed')) {
        // silent
      } else {
        setSocialError('Apple sign-in failed. Please try again or use email.');
      }
    } finally {
      setSocialLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (socialLoading) return;
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithGoogle();
      trackEvent('google_sign_in');
      const loaded = await cloudLoadData(result.userId);
      if (loaded) {
        onLoginSuccess?.(result.userId);
        return;
      }
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName)  setLastName(result.lastName);
      if (result.email)     setEmail(result.email);
      setSocialUserId(result.userId);
      // If Google didn't surface a name, collect it on the name step first.
      setStep(result.firstName ? 2 : 1);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        // silent
      } else {
        setSocialError('Google sign-in failed. Please try again or use email.');
      }
    } finally {
      setSocialLoading(false);
    }
  };

  const handleEnterApp = async () => {
    if (submitting) return;
    if (!dobValidation.ok) {
      setSubmitError(dobValidation.error);
      return;
    }
    if (isUnderThirteen) {
      setSubmitError('You must be at least 13 years old to use Vector Football.');
      return;
    }
    if (needsParental && !parentalConsent) {
      setSubmitError('A parent or guardian must agree before you can continue.');
      return;
    }
    if (!agreedToTerms) {
      setSubmitError('You must agree to the Terms of Use and Privacy Policy before continuing.');
      return;
    }
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
        dateOfBirth:     dobTouched && dobValidation.ok ? dobValidation.value.isoDate : undefined,
        termsAcceptedAt: Date.now(),
        accountType,
      };

      const persistProfileForAuthenticatedFlow = () => {
        // Write profile directly to localStorage before cloudSaveData so it can
        // collect the latest onboarding data immediately. Only do this after
        // auth has succeeded (or local-only mode is active) so a failed offline
        // signup cannot leave a fake completed account on the device.
        localStorage.setItem('vf_user_profile', JSON.stringify(profile));

        // Stash a pending squad code so App can join once the player is authenticated
        // (handles the email-confirmation delay — join happens on first real session).
        if (accountType === 'personal' && teamCode.trim()) {
          localStorage.setItem('vf_pending_team_code', teamCode.trim().toUpperCase());
        } else {
          localStorage.removeItem('vf_pending_team_code');
        }
      };

      // existingUserId = coach-injected; socialUserId = Apple-authenticated. Either
      // means auth is already done, so skip cloudSignUp and just persist the profile.
      let userId: string | undefined = existingUserId || socialUserId;
      let needsConfirmation = false;
      let authFailureMessage = '';
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
            } catch { authFailureMessage = msg; }
          } else {
            authFailureMessage = msg;
          }
        }
      }

      // Fail closed: with Supabase configured, never proceed into the app as a
      // local-only "authenticated" session if sign-up AND sign-in both failed.
      // (Previously this fell through to onComplete with userId=undefined.)
      if (isSupabaseConfigured && !userId && !needsConfirmation) {
        const msg = authFailureMessage.toLowerCase();
        if (!navigator.onLine) {
          setSubmitError('You are offline. Connect to Wi-Fi or mobile data, then try creating your account again.');
        } else if (msg.includes('captcha') || msg.includes('verification')) {
          setSubmitError('Security verification did not finish. Check your connection, wait a moment, then try again.');
        } else if (msg.includes('too_many_attempts')) {
          setSubmitError('Too many attempts. Please wait 15 minutes before trying again.');
        } else {
          setSubmitError('Could not create your account. Please check your connection and try again.');
        }
        return;
      }

      persistProfileForAuthenticatedFlow();

      // Push data to cloud immediately (profile is already in localStorage above)
      if (userId) {
        await cloudSaveData(userId);
      }

      if (needsConfirmation) {
        // Block here — show "check your email" screen and wait for SIGNED_IN event
        const proceed = () => {
          if (stayLoggedIn) rememberLogin(profile.email);
          else forgetRememberedLogin();
          onComplete(profile, '', userId);
        };
        setPendingOnComplete(() => proceed);
        setPendingProfile(profile);
        setHasSignedUp(true);
        setAwaitingEmailConfirm(true);
        return;
      }

      // No plan pre-selected during onboarding — paywall shown immediately after
      if (stayLoggedIn) rememberLogin(profile.email);
      else forgetRememberedLogin();
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
        if (stayLoggedIn) rememberLogin(email, userId);
        else forgetRememberedLogin();
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
      if (confirmEmailCooldown.coolingDown) return;
      setResendLoading(true);
      setResendSent(false);
      try {
        await cloudResendConfirmation(email.trim().toLowerCase());
        confirmEmailCooldown.start();
        setResendSent(true);
      } catch {
        // silent — user can try again
      } finally {
        setResendLoading(false);
      }
    };

    // Fix a mistyped email: create a fresh Supabase signup under the corrected
    // address (re-using the password already entered) so a new confirmation email
    // is sent there. The old unconfirmed account is harmlessly orphaned. Updates
    // the profile + the queued onComplete so the rest of the flow uses the new email.
    const handleChangeEmail = async () => {
      const next = pendingEmail.trim().toLowerCase();
      const v = validateEmail(next);
      if (!v.ok) { setChangeEmailError(v.error); return; }
      if (next === email.trim().toLowerCase()) { setEditingEmail(false); return; }
      setChangeEmailBusy(true);
      setChangeEmailError('');
      try {
        const result = await cloudSignUp(next, password);
        const newUserId = result.userId ?? undefined;
        const base = pendingProfile ?? { email: next } as UserProfile;
        const updatedProfile: UserProfile = { ...base, email: next };
        localStorage.setItem('vf_user_profile', JSON.stringify(updatedProfile));
        setPendingProfile(updatedProfile);
        setEmail(next);
        // Rebuild the queued completion so the confirm-link (SIGNED_IN) and the
        // "I've confirmed" button both finish with the corrected email + new account id.
        setPendingOnComplete(() => () => {
          if (stayLoggedIn) rememberLogin(next); else forgetRememberedLogin();
          onComplete(updatedProfile, '', newUserId);
        });
        setEditingEmail(false);
        setResendSent(false);
        setChangeEmailSent(true);
      } catch (err: unknown) {
        const msg = (err instanceof Error ? err.message : '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists')) {
          setChangeEmailError('That email already has an account. Try signing in instead.');
        } else if (msg.includes('captcha') || msg.includes('verification')) {
          setChangeEmailError('Security check did not finish. Wait a moment and try again.');
        } else if (msg.includes('too_many') || msg.includes('rate') || msg.includes('too many')) {
          setChangeEmailError('Too many attempts. Please wait a little while and try again.');
        } else if (!navigator.onLine) {
          setChangeEmailError('You are offline. Reconnect, then try again.');
        } else {
          setChangeEmailError('Could not update your email. Check your connection and try again.');
        }
      } finally {
        setChangeEmailBusy(false);
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
          disabled={resendLoading || resendSent || confirmEmailCooldown.coolingDown}
          className="text-xs text-brand-500 underline disabled:opacity-50"
        >
          {resendSent
            ? 'Email resent! Check your inbox.'
            : resendLoading
            ? 'Sending…'
            : confirmEmailCooldown.coolingDown
            ? `Resend available in ${confirmEmailCooldown.label}`
            : "Didn't get it? Resend email"}
        </button>

        <p className="mt-4 text-xs text-gray-400">Can't find it? Check your spam folder.</p>

        {/* Inline change-email — fixes a mistyped address without re-doing onboarding */}
        {changeEmailSent && !editingEmail && (
          <p className="mt-4 text-xs text-green-600 max-w-xs">✓ New confirmation link sent to {email}</p>
        )}
        {!editingEmail ? (
          <button
            onClick={() => {
              setPendingEmail(email);
              setEditingEmail(true);
              setChangeEmailError('');
              setChangeEmailSent(false);
            }}
            className="mt-4 text-xs text-brand-500 underline"
          >
            Wrong email? Change it
          </button>
        ) : (
          <div className="w-full max-w-xs mt-4">
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={pendingEmail}
              maxLength={EMAIL_MAX}
              onChange={e => setPendingEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-sm text-center focus:border-brand-400 focus:outline-none mb-2"
            />
            {changeEmailError && <p className="text-red-500 text-xs mb-2">{changeEmailError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingEmail(false); setChangeEmailError(''); }}
                className="flex-1 py-2.5 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeEmail}
                disabled={changeEmailBusy}
                className="flex-1 py-2.5 rounded-2xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {changeEmailBusy ? 'Sending…' : 'Send link here'}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            // Full re-edit: go back to the form to change name/details (not just email).
            setAwaitingEmailConfirm(false);
            setHasSignedUp(false);
            setPendingOnComplete(null);
            setConfirmError('');
            setResendSent(false);
            setEditingEmail(false);
            setStep(1);
          }}
          className="mt-6 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={14} /> Edit other details
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

            {initialNotice && (
              <div className="w-full max-w-xs rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left mb-4">
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">{initialNotice}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs">
              {isAppleSignInAvailable() && (
                <AppleSignInButton onClick={handleAppleSignIn} loading={socialLoading} />
              )}
              {isGoogleSignInAvailable() && (
                <GoogleSignInButton onClick={handleGoogleSignIn} loading={socialLoading} />
              )}
              {socialError && <p className="text-xs text-red-500 -mt-1 text-center">{socialError}</p>}
              {(isAppleSignInAvailable() || isGoogleSignInAvailable()) && (
                <div className="flex items-center gap-3 my-1">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              )}
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
              {OAUTH_ENABLED && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">or</span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                  <OAuthButtons onError={setSubmitError} />
                </>
              )}
            </div>
          </div>
        )}

        {step === -1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-7">Sign in to your account.</p>

            {OAUTH_ENABLED && (
              <div className="mb-5">
                <OAuthButtons onError={setLoginError} />
              </div>
            )}

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

              <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={e => setStayLoggedIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                />
                <span className="text-xs text-gray-500 leading-snug">
                  <span className="font-semibold text-gray-700">Stay logged in</span>
                  <br />
                  Keep this account open when you close or refresh the app.
                </span>
              </label>

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
                    {forgotCooldown.coolingDown && (
                      <p className="text-xs text-amber-600 mt-1">
                        You can send another reset email in {forgotCooldown.label}.
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setShowForgot(false)}
                        className="px-3 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!forgotEmail || forgotLoading || forgotCooldown.coolingDown) return;
                          setForgotLoading(true);
                          setForgotError('');
                          try {
                            await cloudResetPassword(forgotEmail);
                            forgotCooldown.start();
                            setForgotSent(true);
                          } catch {
                            setForgotError('Could not send reset email. Check the address.');
                          }
                          setForgotLoading(false);
                        }}
                        disabled={!forgotEmail || forgotLoading || forgotCooldown.coolingDown}
                        className="flex-1 py-2 rounded-lg text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400"
                      >
                        {forgotLoading ? 'Sending…' : forgotCooldown.coolingDown ? `Try again in ${forgotCooldown.label}` : 'Send Reset Link'}
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
            {socialOrExisting ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Set up your profile</h2>
                <p className="text-gray-500 text-sm mb-7">You're signed in — just fill in your details to get started.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
                <p className="text-gray-500 text-sm mb-7">Your details are stored securely on this device.</p>
                {OAUTH_ENABLED && (
                  <div className="mb-5">
                    <OAuthButtons onError={setSubmitError} />
                  </div>
                )}
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

              {!socialOrExisting && (
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

                  <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={stayLoggedIn}
                      onChange={e => setStayLoggedIn(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                    />
                    <span className="text-xs text-gray-500 leading-snug">
                      <span className="font-semibold text-gray-700">Stay logged in</span>
                      <br />
                      Keep this account open when you close or refresh the app.
                    </span>
                  </label>
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

            {/* Date of birth — inline scroll-wheel pickers */}
            <div className="mb-5">
              <Label>Date of Birth <span style={{fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem'}}>(optional)</span></Label>
              <DateScrollPicker
                day={dobDay}
                month={dobMonth}
                year={dobYear}
                onDayChange={setDobDay}
                onMonthChange={setDobMonth}
                onYearChange={setDobYear}
                onInteract={() => setDobTouched(true)}
              />
              {!dobTouched && (
                <p className="text-xs text-gray-400 mt-1.5 text-center">Optional — scroll to set your date of birth.</p>
              )}
              {dobError && (
                <p className="text-xs text-red-500 mt-1.5 text-center">{dobError}</p>
              )}
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

            {/* Terms checkboxes — shown unless user has confirmed they are under 13. */}
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
