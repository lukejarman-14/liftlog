import { useRef, useState } from 'react';
import { Dumbbell, Eye, EyeOff, UploadCloud, Check } from 'lucide-react';
import { UserProfile } from '../../types';
import { importData } from '../../lib/dataSync';
import { isSupabaseConfigured, cloudSignIn, cloudLoadData } from '../../lib/cloudSync';

interface LoginProps {
  profile: UserProfile;
  onLogin: (userId?: string) => void;
  onForgotPassword: () => void;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function Login({ profile, onLogin, onForgotPassword }: LoginProps) {
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  // Restore from backup
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring,       setRestoring]       = useState(false);
  const [restoreError,    setRestoreError]    = useState('');
  const [restoreSuccess,  setRestoreSuccess]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');

    // ── Cloud auth ─────────────────────────────────────────────────────────
    if (isSupabaseConfigured) {
      try {
        const userId = await cloudSignIn(profile.email, password);
        // Sync latest data from cloud in background
        cloudLoadData(userId);
        onLogin(userId);
      } catch {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setLoading(false);
      return;
    }

    // ── Local fallback ─────────────────────────────────────────────────────
    const hash = await hashPassword(password);
    if (hash === profile.passwordHash) {
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
    setLoading(false);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreError('');
    setRestoreSuccess('');
    try {
      const email = await importData(file);
      setRestoreSuccess(`Data restored for ${email}. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
    }
    setRestoring(false);
    e.target.value = '';
  };

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

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Restore from backup */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          <UploadCloud size={16} />
          {restoring ? 'Restoring…' : 'Restore from Backup File'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleRestoreFile}
        />

        {restoreError && (
          <p className="text-xs text-red-500 mt-2 text-center">{restoreError}</p>
        )}
        {restoreSuccess && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-green-600 text-sm font-semibold">
            <Check size={14} /> {restoreSuccess}
          </div>
        )}

        <button
          onClick={onForgotPassword}
          className="w-full mt-5 text-sm text-gray-400 hover:text-gray-600 text-center py-2"
        >
          Forgot password? Reset app
        </button>
      </div>
    </div>
  );
}
