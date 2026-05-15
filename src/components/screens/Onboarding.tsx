import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Dumbbell, Eye, EyeOff, Check, LogIn, UserPlus } from 'lucide-react';
import { UserProfile } from '../../types';
import { isSupabaseConfigured, cloudSignUp, cloudSignIn, cloudSaveData, cloudLoadData, cloudSignOut, cloudResetPassword } from '../../lib/cloudSync';

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
      {children}
    </label>
  );
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Total wizard steps (excluding welcome): steps 1 and 2
const TOTAL_STEPS = 2;

export function Onboarding({ onComplete, onLoginSuccess, existingUserId }: OnboardingProps) {
  // step: 0 = landing, -1 = login mode, 1 = create account, 2 = body metrics
  // If existingUserId is provided, skip landing and go straight to profile setup
  const [step, setStep] = useState(existingUserId ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

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
  const [step1Error,      setStep1Error]       = useState('');

  // Step 2 — Body metrics (optional)
  const [heightStr, setHeightStr] = useState('');
  const [weightStr, setWeightStr] = useState('');
  const [gender,    setGender]    = useState<'male' | 'female' | 'other' | ''>('');

  // ── Validation ─────────────────────────────────────────────────────────────
  const passwordStrong = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword !== '';
  const canCreateAccount = existingUserId
    ? firstName.trim() !== '' && lastName.trim() !== '' && email.includes('@')
    : firstName.trim() !== '' && lastName.trim() !== '' && email.includes('@') && passwordStrong && passwordsMatch;

  // ── Login attempt ──────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      // ── Cloud login (Supabase configured) ───────────────────────────────
      if (isSupabaseConfigured) {
        let userId: string;
        try {
          userId = await cloudSignIn(loginEmail.trim().toLowerCase(), loginPassword);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('Invalid login credentials') || msg.includes('invalid')) {
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
          // Cloud data found — reload so all useLocalStorage hooks re-read fresh data
          setRestoreSuccess('Signed in! Loading your data…');
          setTimeout(() => window.location.reload(), 800);
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
            setLoginLoading(false);
          }
        }
        return;
      }

      // ── Local fallback (no Supabase) ─────────────────────────────────────
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
        const entered = await hashPassword(loginPassword);
        if (entered !== profile.passwordHash) {
          setLoginError('Email or password is incorrect.');
          setLoginLoading(false);
          return;
        }
      }

      onLoginSuccess?.();
    } catch {
      setLoginError('Something went wrong. Please try again.');
    }
    setLoginLoading(false);
  };


  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleCreateAccount = async () => {
    if (!canCreateAccount) return;
    setStep1Error('');
    setStep(2);
  };

  const handleEnterApp = async () => {
    if (submitting) return;
    setSubmitting(true);
    // Only hash a password when the user is creating a new account
    const passwordHash = existingUserId ? undefined : await hashPassword(password);
    const profile: UserProfile = {
      firstName:       firstName.trim(),
      lastName:        lastName.trim(),
      email:           email.trim().toLowerCase(),
      passwordHash,
      position:        'CM',
      experienceYears: '1-3',
      gymFrequency:    '1-2',
      goals:           [],
      gymAccess:       'full',
      completedAt:     Date.now(),
      heightCm:        heightStr ? parseFloat(heightStr) : undefined,
      weightKg:        weightStr ? parseFloat(weightStr) : undefined,
      gender:          gender || undefined,
    };

    // Write profile directly to localStorage NOW so cloudSaveData always finds it,
    // regardless of whether React's useEffect has committed yet.
    localStorage.setItem('vf_user_profile', JSON.stringify(profile));

    let userId: string | undefined = existingUserId;
    if (!userId && isSupabaseConfigured) {
      try {
        const id = await cloudSignUp(profile.email, password);
        if (id) userId = id;
      } catch (err: unknown) {
        // If account already exists in Supabase, try signing in instead
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          try {
            const id = await cloudSignIn(profile.email, password);
            if (id) userId = id;
          } catch { /* fall through to local-only */ }
        }
      }
    }

    onComplete(profile, '', userId);

    // Push data to cloud immediately (profile is already in localStorage above)
    if (userId) {
      await cloudSaveData(userId);
    }
  };

  // ── Progress bar ───────────────────────────────────────────────────────────
  const progressPct = step <= 0 ? 0 : (step / TOTAL_STEPS) * 100;

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

        {/* ── STEP 0: Landing ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center items-center text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center mb-6 shadow-lg">
              <Dumbbell size={36} className="text-white" />
            </div>
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

        {/* ── STEP -1: Login mode ─────────────────────────────────────────── */}
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

        {/* ── STEP 1: Create account ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 1 of 2</p>
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
                        onChange={e => { setPassword(e.target.value); setStep1Error(''); }}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
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
                        onChange={e => { setConfirmPassword(e.target.value); setStep1Error(''); }}
                        type={showConfirm ? 'text' : 'password'}
                        style={{ fontSize: '16px' }}
                        placeholder="Re-enter password"
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

              {step1Error && (
                <p className="text-sm text-red-500 text-center">{step1Error}</p>
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

        {/* ── STEP 2: Body metrics (final) ────────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 flex flex-col py-12 pt-16">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">Step 2 of 2</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">About you</h2>
            <p className="text-gray-500 text-sm mb-7">Used to personalise your programme. All optional — you can add these later in Settings.</p>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Height (cm) <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <input
                    value={heightStr}
                    onChange={e => setHeightStr(e.target.value)}
                    type="number"
                    min="100"
                    max="230"
                    placeholder="e.g. 180"
                    style={{ fontSize: '16px' }}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <Label>Weight (kg) <span className="text-gray-400 normal-case font-normal">optional</span></Label>
                  <input
                    value={weightStr}
                    onChange={e => setWeightStr(e.target.value)}
                    type="number"
                    min="30"
                    max="200"
                    placeholder="e.g. 75"
                    style={{ fontSize: '16px' }}
                    className={inputClass()}
                  />
                </div>
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

        {/* ── Nav buttons ─────────────────────────────────────────────────── */}
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
              onClick={handleEnterApp}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${
                submitting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              }`}
            >
              {submitting ? 'Creating…' : 'Enter App'}
              {!submitting && <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
