import { useState } from 'react';
import { Dumbbell, Eye, EyeOff, Check, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../../types';
import { isSupabaseConfigured, cloudSignIn, cloudLoadData, cloudResetPassword } from '../../lib/cloudSync';

interface LoginProps {
  profile: UserProfile;
  onLogin: (userId?: string) => void;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function Login({ profile, onLogin }: LoginProps) {
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  // Forgot password state
  const [showForgot,     setShowForgot]     = useState(false);
  const [forgotEmail,    setForgotEmail]    = useState(profile.email || '');
  const [forgotLoading,  setForgotLoading]  = useState(false);
  const [forgotSent,     setForgotSent]     = useState(false);
  const [forgotError,    setForgotError]    = useState('');

  // Restore from backup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');

    if (isSupabaseConfigured) {
      try {
        const userId = await cloudSignIn(profile.email, password);
        const loaded = await cloudLoadData(userId);
        if (loaded) {
          // Reload so all useLocalStorage hooks re-read the freshly restored cloud data
          window.location.reload();
        } else {
          onLogin(userId);
        }
      } catch {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setLoading(false);
      return;
    }

    const hash = await hashPassword(password);
    if (hash === profile.passwordHash) {
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
    setLoading(false);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || forgotLoading) return;
    setForgotLoading(true);
    setForgotError('');
    try {
      await cloudResetPassword(forgotEmail);
      setForgotSent(true);
    } catch {
      setForgotError('Could not send reset email. Check the address and try again.');
    }
    setForgotLoading(false);
  };

  // ── Forgot password view ───────────────────────────────────────────────────
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
            <div className="flex flex-col items-center gap-3 text-green-600 font-semibold text-center">
              <Check size={32} />
              <p>Reset link sent to <strong>{forgotEmail}</strong>.<br />Check your inbox and click the link.</p>
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
                  className={`w-full px-4 py-3 rounded-xl border ${
                    forgotError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                  } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`}
                />
                {forgotError && <p className="text-xs text-red-500 mt-1.5">{forgotError}</p>}
              </div>

              <button
                type="submit"
                disabled={!forgotEmail || forgotLoading}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                  forgotEmail && !forgotLoading
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Normal login view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">
            {profile.firstName} {profile.lastName}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                className={`w-full px-4 py-3 rounded-xl border ${
                  error ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>

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

        {/* Forgot password */}
        <button
          onClick={() => setShowForgot(true)}
          className="w-full mt-3 text-sm text-brand-500 hover:text-brand-600 text-center py-2 font-semibold"
        >
          Forgot password?
        </button>

      </div>
    </div>
  );
}
