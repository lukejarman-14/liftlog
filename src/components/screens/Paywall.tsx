import { useState } from 'react';
import { X, Zap, Check, Shield, Lock } from 'lucide-react';

interface PaywallProps {
  /** Why the paywall appeared — shown in subtitle */
  featureLabel?: string;
  /** Days left in trial (null = no trial started) */
  trialDaysLeft: number | null;
  /** Trial has expired (started but > 14 days ago) */
  isTrialExpired: boolean;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
  onStartTrial: () => void;
  onDismiss: () => void;
}

const FEATURES = [
  'AI programme builder — position-specific, match-day periodised',
  'Progressive overload — auto weight targets every session',
  'Play-style differentiation — sessions built for how you play',
  'Full programme view — all weeks, all sessions',
  'Conditioning auto-progression — intervals increase as you improve',
  'Strength setup — 1RM-based weekly load prescriptions',
];

export function Paywall({
  featureLabel,
  trialDaysLeft,
  isTrialExpired,
  onSelectPlan,
  onStartTrial,
  onDismiss,
}: PaywallProps) {
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');

  const noTrialYet = trialDaysLeft === null;
  const trialActive = trialDaysLeft !== null && trialDaysLeft > 0;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="relative flex items-center justify-center pt-14 pb-6 px-6 bg-gradient-to-b from-brand-600 to-brand-500 text-white">
        <button
          onClick={onDismiss}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X size={16} />
        </button>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Zap size={28} className="text-yellow-300" />
          </div>
          <h1 className="text-2xl font-extrabold mb-1">Vector Football Premium</h1>
          {featureLabel && (
            <p className="text-sm text-white/80">
              <Lock size={12} className="inline mr-1 mb-0.5" />
              {featureLabel} is a Premium feature
            </p>
          )}
          {trialActive && (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-yellow-400/90 text-yellow-900 text-xs font-bold">
              {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left in trial
            </div>
          )}
          {isTrialExpired && (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-red-400/90 text-white text-xs font-bold">
              Trial ended — subscribe to continue
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-6 max-w-sm mx-auto w-full">
        {/* Feature list */}
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">What you get</p>
          <div className="flex flex-col gap-2">
            {FEATURES.map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={11} className="text-brand-600" strokeWidth={3} />
                </div>
                <span className="text-sm text-gray-700 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan selector */}
        <div className="mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Choose a plan</p>
          <div className="flex flex-col gap-3">
            {/* Annual — recommended */}
            <button
              onClick={() => setSelected('annual')}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative ${
                selected === 'annual'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="absolute -top-2.5 right-4 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                BEST VALUE
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === 'annual' ? 'border-brand-500 bg-brand-500' : 'border-gray-300 bg-white'
                }`}>
                  {selected === 'annual' && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">Annual</p>
                  <p className="text-xs text-gray-400 mt-0.5">Billed once per year</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-brand-600 text-lg">£89.99<span className="text-xs font-normal text-gray-400">/yr</span></p>
                  <p className="text-xs text-gray-400">≈ £7.50/mo</p>
                </div>
              </div>
            </button>

            {/* Monthly */}
            <button
              onClick={() => setSelected('monthly')}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                selected === 'monthly'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === 'monthly' ? 'border-brand-500 bg-brand-500' : 'border-gray-300 bg-white'
                }`}>
                  {selected === 'monthly' && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">Monthly</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cancel anytime</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-gray-700 text-lg">£7.99<span className="text-xs font-normal text-gray-400">/mo</span></p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {noTrialYet ? (
            <>
              <button
                onClick={onStartTrial}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors"
              >
                Start 14-Day Free Trial
              </button>
              <p className="text-center text-xs text-gray-400">
                No payment needed now. Subscribe before trial ends to keep access.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectPlan(selected)}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors"
              >
                Subscribe — {selected === 'annual' ? '£89.99/yr' : '£7.99/mo'}
              </button>
              {trialActive && (
                <p className="text-center text-xs text-gray-400">
                  You won't be charged until your trial ends.
                </p>
              )}
            </>
          )}
        </div>

        {/* Trust signals */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Shield size={12} />
          <span>Secure payment · Cancel anytime · Restore purchases</span>
        </div>
      </div>
    </div>
  );
}
