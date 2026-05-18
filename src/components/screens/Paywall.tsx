import { useState } from 'react';
import { X, Zap, Check, Shield, Lock, RotateCcw } from 'lucide-react';
import { RCPlan } from '../../hooks/usePremium';

interface PaywallProps {
  featureLabel?: string;
  trialDaysLeft: number | null;
  isTrialExpired: boolean;
  purchasing: boolean;
  restoring: boolean;
  purchaseError: string | null;
  onSelectPlan: (plan: RCPlan) => void;
  onStartTrial: () => void;
  onRestore: () => void;
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

const PLANS: { id: RCPlan; label: string; price: string; sub: string; badge?: string }[] = [
  { id: 'lifetime', label: 'Lifetime', price: '£150.00', sub: 'One-time payment — forever', badge: 'BEST VALUE' },
  { id: 'yearly',   label: 'Annual',   price: '£89.99', sub: 'Billed once per year · ≈ £7.50/mo' },
  { id: 'monthly',  label: 'Monthly',  price: '£7.99',  sub: 'Cancel anytime' },
];

export function Paywall({
  featureLabel,
  trialDaysLeft,
  isTrialExpired,
  purchasing,
  restoring,
  purchaseError,
  onSelectPlan,
  onStartTrial,
  onRestore,
  onDismiss,
}: PaywallProps) {
  const [selected, setSelected] = useState<RCPlan>('lifetime');

  const noTrialYet = trialDaysLeft === null;
  const trialActive = trialDaysLeft !== null && trialDaysLeft > 0;

  const selectedPlan = PLANS.find(p => p.id === selected)!;
  const busy = purchasing || restoring;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="relative flex items-center justify-center pt-14 pb-6 px-6 bg-gradient-to-b from-brand-600 to-brand-500 text-white">
        <button
          onClick={onDismiss}
          disabled={busy}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40"
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
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                disabled={busy}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative disabled:opacity-50 ${
                  selected === plan.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-2.5 right-4 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected === plan.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300 bg-white'
                  }`}>
                    {selected === plan.id && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{plan.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{plan.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-extrabold text-lg ${selected === plan.id ? 'text-brand-600' : 'text-gray-700'}`}>
                      {plan.price}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {purchaseError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 font-medium">{purchaseError}</p>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {noTrialYet ? (
            <>
              <button
                onClick={onStartTrial}
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors disabled:opacity-50"
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
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {purchasing ? (
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  `${selected === 'lifetime' ? 'Buy' : 'Subscribe'} — ${selectedPlan.price}`
                )}
              </button>
              {trialActive && (
                <p className="text-center text-xs text-gray-400">
                  You won't be charged until your trial ends.
                </p>
              )}
            </>
          )}

          <button
            onClick={onRestore}
            disabled={busy}
            className="w-full py-2.5 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {restoring ? (
              <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            ) : (
              <>
                <RotateCcw size={13} />
                Restore purchases
              </>
            )}
          </button>
        </div>

        {/* Trust signals */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Shield size={12} />
          <span>Secure payment · Cancel anytime · Apple-verified</span>
        </div>
      </div>
    </div>
  );
}
