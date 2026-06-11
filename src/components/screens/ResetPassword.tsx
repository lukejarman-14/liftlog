import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Dumbbell, Eye, EyeOff, Check } from 'lucide-react';
import { cloudUpdatePassword } from '../../lib/cloudSync';
import { validatePassword } from '../../lib/validation';
import { useActionCooldown } from '../../hooks/useActionCooldown';

interface ResetPasswordProps {
  onDone: () => void;
}

export function ResetPassword({ onDone }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordCooldown = useActionCooldown('password-change', 'reset-link');

  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || loading || passwordCooldown.coolingDown) return;
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    // Central validator enforces both min (8) and max (128) length consistently.
    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) { setError(pwCheck.error); return; }

    setLoading(true);
    setError('');
    try {
      await cloudUpdatePassword(password);
      passwordCooldown.start();
      setSuccess(true);
      doneTimerRef.current = setTimeout(onDone, 1500);
    } catch {
      setError('Failed to update password. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a strong password</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 text-green-600 font-semibold">
            <Check size={32} />
            <p>Password updated! Signing you in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                New Password
              </label>
              <div className="relative">
                <input
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  autoFocus
                  style={{ fontSize: '16px' }}
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
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                Confirm Password
              </label>
              <input
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                style={{ fontSize: '16px' }}
                className={`w-full px-4 py-3 rounded-xl border ${
                  error ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                } bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400`}
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
              {passwordCooldown.coolingDown && (
                <p className="text-xs text-amber-600 mt-1.5">
                  You can change your password again in {passwordCooldown.label}.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password || !confirm || loading || passwordCooldown.coolingDown}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                password && confirm && !loading && !passwordCooldown.coolingDown
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Updating…' : passwordCooldown.coolingDown ? `Try again in ${passwordCooldown.label}` : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
