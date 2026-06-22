import { useState, type FormEvent } from 'react';
import { Dumbbell, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../../types';
import { isSupabaseConfigured, cloudSignIn, cloudLoadData, cloudResetPassword } from '../../lib/cloudSync';
import { hashPassword } from '../../lib/authUtils';
import { signInWithApple, isAppleSignInAvailable, signInWithGoogle, isGoogleSignInAvailable } from '../../lib/socialAuth';
import { AppleSignInButton } from '../AppleSignInButton';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { activateAppReviewDemo, isAppReviewDemoLogin } from '../../lib/appReviewDemo';
import { activateDemoFilming, isDemoFilmingLogin } from '../../lib/demoFilming';
import { forgetRememberedLogin, rememberLogin } from '../../lib/authPersistence';
import { useActionCooldown } from '../../hooks/useActionCooldown';
import { OAuthButtons } from '../OAuthButtons';
import { OAUTH_ENABLED } from '../../lib/featureFlags';
import { getFriendlyAuthError } from '../../lib/authErrors';

interface LoginProps {
  profile: UserProfile;
  onLogin: (userId?: string) => void;
  onStartOver: () => void;
}



export function Login({ profile, onLogin, onStartOver }: LoginProps) {
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  // Forgot password state
  const [showForgot,     setShowForgot]     = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState(profile.email || '');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotSent,     setForgotSent]     = useState(false);
  const [forgotError,    setForgotError]    = useState('');
  const forgotCooldown = useActionCooldown('password-reset', forgotEmail || profile.email || 'unknown');

  // Start over confirmation
  const [confirmStartOver, setConfirmStartOver] = useState(false);

  // Apple sign-in
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError,   setSocialError]   = useState('');

  const handleAppleSignIn = async () => {
    if (socialLoading) return;
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithApple();
      // Load any cloud data for this account, then enter the app.
      await cloudLoadData(result.userId);
      onLogin(result.userId);
      // Component unmounts here — no state updates past this point.
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('cancel') || msg.includes('1001') || msg.includes('popup_closed')) {
        // user cancelled — silent
      } else {
        setSocialError('Apple sign-in failed. Please try again.');
      }
      setSocialLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (socialLoading) return;
    setSocialLoading(true);
    setSocialError('');
    try {
      const result = await signInWithGoogle();
      await cloudLoadData(result.userId);
      onLogin(result.userId);
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('cancel') || msg.includes('cancelled')) {
        // user cancelled — silent
      } else {
        setSocialError('Google sign-in failed. Please try again.');
      }
      setSocialLoading(false);
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');

    if (isAppReviewDemoLogin(profile.email, password)) {
      activateAppReviewDemo();
      if (stayLoggedIn) rememberLogin(profile.email);
      else forgetRememberedLogin();
      onLogin();
      return;
    }

    if (isDemoFilmingLogin(profile.email, password)) {
      activateDemoFilming();
      if (stayLoggedIn) rememberLogin(profile.email);
      else forgetRememberedLogin();
      onLogin();
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const userId = await cloudSignIn(profile.email, password);
        // cloudLoadData fires 'vf-cloud-restored' which causes all useLocalStorage hooks
        // to re-read from localStorage — no page reload needed
        await cloudLoadData(userId);
        if (stayLoggedIn) rememberLogin(profile.email);
        else forgetRememberedLogin();
        onLogin(userId);
        // Component unmounts here — do not call any state setters after this point
        return;
      } catch (err) {
        setError(getFriendlyAuthError(err, 'Sign in failed. Please try again.'));
        setPassword('');
        setLoading(false);
      }
      return;
    }

    const hash = await hashPassword(password, profile.email);
    if (hash === profile.passwordHash) {
      if (stayLoggedIn) rememberLogin(profile.email);
      else forgetRememberedLogin();
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
    setLoading(false);
  };

  const handleSendReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || forgotLoading || forgotCooldown.coolingDown) return;
    setForgotLoading(true);
    setForgotError('');
    try {
      await cloudResetPassword(forgotEmail);
      forgotCooldown.start();
      setForgotSent(true);
    } catch (err) {
      setForgotError(getFriendlyAuthError(err, 'Could not send reset email. Check the address and try again.'));
    }
    setForgotLoading(false);
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <button
            onClick={() => { setShowForgot(false); setForgotSent(false); setForgotError(''); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft size={14} /> Back to login
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 shadow-lg">
              <Dumbbell size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Reset password</h1>
            <p className="text-sm text-gray-500 mt-1 text-center">
              We'll send a reset link to your email
            </p>
          </div>

          {forgotSent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex flex-col items-center gap-3 text-green-600 font-semibold">
                <Check size={32} />
                <p>Reset link sent to <strong>{forgotEmail}</strong>.<br />Check your inbox and click the link.</p>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                📬 If you don't see it within a minute, check your <strong>junk or spam folder</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendReset} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Email address
                </label>
                <input
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                  type="email"
                  placeholder="your@email.com"
                  autoFocus
                  style={{ fontSize: '16px' }}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    forgotError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                  } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`}
                />
                {forgotError && <p className="text-xs text-red-500 mt-1.5">{forgotError}</p>}
                {forgotCooldown.coolingDown && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    You can send another reset email in {forgotCooldown.label}.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!forgotEmail || forgotLoading || forgotCooldown.coolingDown}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                  forgotEmail && !forgotLoading && !forgotCooldown.coolingDown
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {forgotLoading ? 'Sending…' : forgotCooldown.coolingDown ? `Try again in ${forgotCooldown.label}` : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">
            {profile.firstName} {profile.lastName}
          </p>
        </div>

        {OAUTH_ENABLED && (
          <div className="mb-5">
            <OAuthButtons onError={setError} />
          </div>
        )}

        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoFocus
                autoComplete="current-password"
                style={{ fontSize: '16px' }}
                className={`w-full px-4 py-3 rounded-xl border ${
                  error ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
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

          <button
            type="submit"
            disabled={!password || loading}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
              password && !loading
                ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {(isAppleSignInAvailable() || isGoogleSignInAvailable()) && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="flex flex-col gap-3">
              {isAppleSignInAvailable() && (
                <AppleSignInButton onClick={handleAppleSignIn} label="Sign in with Apple" loading={socialLoading} />
              )}
              {isGoogleSignInAvailable() && (
                <GoogleSignInButton onClick={handleGoogleSignIn} label="Sign in with Google" loading={socialLoading} />
              )}
            </div>
            {socialError && <p className="text-xs text-red-500 mt-2 text-center">{socialError}</p>}
          </div>
        )}

        <button
          onClick={() => setShowForgot(true)}
          className="w-full mt-3 text-sm text-brand-500 hover:text-brand-600 text-center py-2 font-semibold"
        >
          Forgot password?
        </button>

        {!confirmStartOver ? (
          <button
            onClick={() => setConfirmStartOver(true)}
            className="w-full mt-1 text-xs text-gray-400 hover:text-gray-600 text-center py-2"
          >
            Create new account
          </button>
        ) : (
          <div className="mt-2 p-4 rounded-xl border border-red-200 bg-red-50 text-center">
            <p className="text-xs text-red-700 font-semibold mb-1">This will delete all local data</p>
            <p className="text-xs text-red-500 mb-3">Your account and cloud data are kept — you'll just need to sign in again.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStartOver(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onStartOver}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
              >
                Start fresh
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
