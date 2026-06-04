import { useState, useEffect } from 'react';
import { X, Zap, Check, Shield, Lock, RotateCcw, Tag, Mail, ChevronLeft, UserPlus, Dumbbell, Building2 } from 'lucide-react';
import { RCPlan } from '../../hooks/usePremium';
import { trackEvent } from '../../lib/analytics';

interface PaywallProps {
  featureLabel?: string;
  pendingEmailConfirm?: boolean;
  /** Which paywall to show. Coach/Club show squad pricing + features. Defaults to personal. */
  accountType?: 'personal' | 'coach' | 'club';
  /** When provided, a back button lets the user change their account type from the paywall. */
  onChangeAccountType?: (type: 'personal' | 'coach' | 'club') => void;
  trialDaysLeft: number | null;
  isTrialExpired: boolean;
  purchasing: boolean;
  restoring: boolean;
  purchaseError: string | null;
  onSelectPlan: (plan: RCPlan, noTrial?: boolean) => void;
  onStartTrial: (plan: RCPlan) => void;
  onRestore: () => void;
  onRedeemCode: (code: string) => Promise<string | null>;
  onRedeemReferral: (code: string) => Promise<string | null>;
  onDismiss: () => void;
  onContinueFree?: () => void;
}

type PlanCard = { id: RCPlan; label: string; price: string; sub: string; badge?: string; saving?: string };

const PERSONAL_FEATURES = [
  'Smart programme builder — position-specific, match-day periodised',
  'Progressive overload — exact weight targets every session',
  'Play-style differentiation — sessions built for how you play',
  'Full programme view — all weeks, all sessions at a glance',
  'Conditioning auto-progression — intervals increase as you improve',
  'Training load chart — weekly volume & ACWR injury risk monitoring',
];

const COACH_FEATURES = [
  'Manage up to 30 players on one account',
  'Share an invite code — players join your squad instantly',
  'Assign programmes to one player or your whole squad',
  'Squad readiness dashboard — see everyone at a glance',
  'Track every player’s testing results & progress',
  'Your players get full Premium access included — they pay nothing',
];

const PERSONAL_PLANS: PlanCard[] = [
  { id: 'yearly',   label: 'Annual',   price: '£79.99', sub: 'Just £6.67/mo · billed once a year', badge: 'BEST VALUE', saving: 'Save £1.32/mo vs monthly' },
  { id: 'monthly',  label: 'Monthly',  price: '£7.99',  sub: 'Billed monthly · cancel anytime' },
  { id: 'lifetime', label: 'Lifetime', price: '£150.00', sub: 'One-time payment — yours forever' },
];

const COACH_PLANS: PlanCard[] = [
  { id: 'yearly',  label: 'Coach Annual',  price: '£299.00', sub: 'Just £24.92/mo · billed once a year', badge: 'BEST VALUE', saving: 'Save ~£120/yr vs monthly' },
  { id: 'monthly', label: 'Coach Monthly', price: '£34.99',  sub: 'Up to 30 players · cancel anytime' },
];

const CLUB_FEATURES = [
  'One licence for your entire club or academy',
  'Add multiple coaches, each managing their own teams',
  'Unlimited players across all age groups',
  'Club-wide readiness, testing & compliance overview',
  'Every player gets full Premium — included',
  'Priority support & onboarding for your staff',
];

const CLUB_PLANS: PlanCard[] = [
  { id: 'yearly',  label: 'Club Annual',  price: '£899.00', sub: 'Just £74.92/mo · billed once a year', badge: 'BEST VALUE', saving: 'Save ~£300/yr vs monthly' },
  { id: 'monthly', label: 'Club Monthly', price: '£99.99',  sub: 'Unlimited coaches & players · cancel anytime' },
];

export function Paywall({
  featureLabel,
  pendingEmailConfirm,
  accountType = 'personal',
  onChangeAccountType,
  trialDaysLeft,
  isTrialExpired,
  purchasing,
  restoring,
  purchaseError,
  onSelectPlan,
  onStartTrial,
  onRestore,
  onRedeemCode,
  onRedeemReferral,
  onDismiss,
  onContinueFree,
}: PaywallProps) {
  const isClub = accountType === 'club';
  const isCoach = accountType === 'coach';
  const isSquad = isCoach || isClub;
  const PLANS = isClub ? CLUB_PLANS : isCoach ? COACH_PLANS : PERSONAL_PLANS;
  const FEATURES = isClub ? CLUB_FEATURES : isCoach ? COACH_FEATURES : PERSONAL_FEATURES;
  const [selected, setSelected] = useState<RCPlan>('yearly');
  const [choosing, setChoosing] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState(false);

  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState(false);

  const noTrialYet = trialDaysLeft === null;
  const trialActive = trialDaysLeft !== null && trialDaysLeft > 0;

  const selectedPlan = PLANS.find(p => p.id === selected)!;
  const busy = purchasing || restoring;

  // Analytics: fire once when the paywall is rendered; derive source from featureLabel
  useEffect(() => {
    const source = featureLabel
      ? featureLabel.toLowerCase().replace(/\s+/g, '_')
      : 'direct';
    trackEvent('paywall_viewed', { trigger_source: source });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Maps RC plan IDs → analytics tier names
  const toTier = (plan: RCPlan): 'monthly' | 'annual' | 'lifetime' =>
    plan === 'yearly' ? 'annual' : (plan as 'monthly' | 'lifetime');

  const handleStartTrial = () => {
    trackEvent('trial_started', { tier: toTier(selected) });
    onStartTrial(selected);
  };

  const handleSelectPlan = (plan: RCPlan, noTrial?: boolean) => {
    trackEvent('purchase_initiated', { tier: toTier(plan), no_trial: noTrial ?? false });
    onSelectPlan(plan, noTrial);
  };

  // Account-type chooser — reached via the paywall back button
  if (choosing && onChangeAccountType) {
    const options: { id: 'personal' | 'coach' | 'club'; label: string; desc: string; icon: typeof UserPlus }[] = [
      { id: 'personal', label: 'Personal', desc: 'Your own personalised training — just for you.', icon: UserPlus },
      { id: 'coach', label: 'Coach', desc: 'Manage up to 30 players on one account.', icon: Dumbbell },
      { id: 'club', label: 'Club / Academy', desc: 'Multiple coaches and teams under one licence.', icon: Building2 },
    ];
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-gray-50 overflow-y-auto">
        <div
          className="relative flex items-center pb-6 px-5 bg-gradient-to-b from-brand-600 to-brand-500 text-white"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
        >
          <button onClick={() => setChoosing(false)} aria-label="Back" className="flex items-center gap-1 text-white/90 text-sm font-medium">
            <ChevronLeft size={18} /> Back
          </button>
        </div>
        <div className="flex-1 px-5 py-6 max-w-sm mx-auto w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose your account</h2>
          <p className="text-gray-500 text-sm mb-6">Pick the plan that fits — your pricing updates to match.</p>
          <div className="flex flex-col gap-4">
            {options.map(opt => {
              const Icon = opt.icon;
              const active = accountType === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => { onChangeAccountType(opt.id); setChoosing(false); }}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${active ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-gray-200 bg-white hover:border-brand-300'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={20} className="text-brand-500" />
                      <span className="text-lg font-bold text-gray-900">{opt.label}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}>
                      {active && <Check size={12} className="text-white" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div
        className="relative flex items-center justify-center pb-6 px-6 bg-gradient-to-b from-brand-600 to-brand-500 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        {onChangeAccountType && (
          <button
            onClick={() => setChoosing(true)}
            disabled={busy}
            aria-label="Change account type"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
            className="absolute left-5 h-8 px-2.5 flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40 text-sm font-medium"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <button
          onClick={onDismiss}
          disabled={busy}
          aria-label="Dismiss"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
          className="absolute right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40"
        >
          <X size={16} />
        </button>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Zap size={28} className="text-yellow-300" />
          </div>
          <h1 className="text-2xl font-extrabold mb-1">{isClub ? 'Vector Football Club' : isCoach ? 'Vector Football Coach' : 'Vector Football Premium'}</h1>
          {isSquad && (
            <p className="text-sm text-white/80">{isClub ? 'One licence · unlimited coaches & players' : 'One subscription · up to 30 players'}</p>
          )}
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
        {/* Email confirmation banner */}
        {pendingEmailConfirm && (
          <div className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <Mail size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              Check your inbox for a confirmation email and tap the link before using a promo code or starting a trial.
            </p>
          </div>
        )}
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

        {/* Plan selector — hidden for the sales-led Club tier */}
        {!isClub && (
        <div className="mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Choose a plan</p>
          <div className="flex flex-col gap-3">
            {PLANS.map(plan => {
              const isSelected = selected === plan.id;
              const isAnnual = plan.id === 'yearly';
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  disabled={busy}
                  className={`w-full text-left rounded-2xl border-2 transition-all relative disabled:opacity-50 ${
                    isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'
                  } ${isAnnual ? 'p-4' : 'p-3.5'}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-2.5 right-4 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isAnnual ? 'w-5 h-5' : 'w-4 h-4'
                    } ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <Check size={isAnnual ? 10 : 8} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-gray-900 ${isAnnual ? 'text-sm' : 'text-xs'}`}>{plan.label}</p>
                      <p className={`text-gray-400 mt-0.5 ${isAnnual ? 'text-xs' : 'text-[11px]'}`}>{plan.sub}</p>
                      {plan.saving && isSelected && (
                        <p className="text-[11px] font-bold text-brand-600 mt-0.5">{plan.saving}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`font-extrabold ${isAnnual ? 'text-xl' : 'text-base'} ${isSelected ? 'text-brand-600' : 'text-gray-700'}`}>
                        {plan.price}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* Error */}
        {purchaseError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 font-medium">{purchaseError}</p>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {isClub ? (
            <>
              <a
                href="mailto:clubs@vectorfootball.co.uk?subject=Vector%20Football%20Club%20enquiry"
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors text-center"
              >
                Book a demo
              </a>
              <p className="text-center text-xs text-gray-400 leading-snug">
                Club &amp; academy licences are set up with our team — we'll tailor pricing to your number of coaches and teams.
              </p>
            </>
          ) : noTrialYet ? (
            <>
              <button
                onClick={handleStartTrial}
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-brand-500 text-white font-extrabold text-base shadow-md hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                Start 30-Day Free Trial
              </button>
              <p className="text-center text-xs text-gray-400 leading-snug">
                {selected === 'lifetime'
                  ? `Free for 30 days, then ${selectedPlan.price} once — no subscription.`
                  : `Free for 30 days, then ${selectedPlan.price}${selected === 'yearly' ? '/year' : '/month'}, auto-renewing. Cancel anytime.`
                }
              </p>
              <button
                onClick={() => handleSelectPlan(selected, true)}
                disabled={busy}
                className="w-full py-3.5 rounded-2xl border-2 border-brand-500 text-brand-600 font-extrabold text-base hover:bg-brand-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span className="w-5 h-5 border-2 border-brand-400 border-t-brand-600 rounded-full animate-spin" />
                ) : (
                  `${selected === 'lifetime' ? 'Buy' : 'Subscribe'} Now — ${selectedPlan.price}`
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSelectPlan(selected)}
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

          {!isClub && (
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
          )}

          {onContinueFree && (
            <button
              onClick={onContinueFree}
              disabled={busy}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              Continue with free version
            </button>
          )}
        </div>

        {/* Legal links — required by App Store guideline 3.1.2(c) */}
        <p className="text-center text-xs text-gray-400 mt-2 leading-relaxed">
          By subscribing you agree to our{' '}
          <a href="https://vectorfootball.co.uk/terms" target="_blank" rel="noopener noreferrer" className="underline text-gray-500">Terms of Use</a>
          {' '}and{' '}
          <a href="https://vectorfootball.co.uk/privacy" target="_blank" rel="noopener noreferrer" className="underline text-gray-500">Privacy Policy</a>.
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
          Manage or cancel in your Apple ID settings.
        </p>

        {/* Referral & promo codes — not shown for the sales-led Club tier */}
        {!isClub && (<>
        {/* Referral code */}
        <div className="mt-4">
          {!showReferralInput ? (
            <button
              onClick={() => setShowReferralInput(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-200 text-brand-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors"
            >
              🤝 Been referred by a friend?
            </button>
          ) : referralSuccess ? (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
              <p className="text-sm font-bold text-green-700">Referral applied!</p>
              <p className="text-xs text-green-600 mt-0.5">You've got 21 days free — enjoy!</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 px-1">Enter your friend's referral code for 21 days free</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralCode}
                  onChange={e => { setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setReferralError(null); }}
                  placeholder="e.g. VFABC123"
                  style={{ fontSize: '16px' }}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  onClick={async () => {
                    if (!referralCode.trim()) return;
                    setReferralLoading(true);
                    setReferralError(null);
                    const err = await onRedeemReferral(referralCode);
                    setReferralLoading(false);
                    if (err) {
                      setReferralError(err);
                    } else {
                      setReferralSuccess(true);
                    }
                  }}
                  disabled={referralLoading || !referralCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-brand-600 transition-colors"
                >
                  {referralLoading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
                  ) : 'Apply'}
                </button>
              </div>
              {referralError && (
                <p className="text-xs text-red-600 mt-1.5 px-1">{referralError}</p>
              )}
            </div>
          )}
        </div>

        {/* Promo code */}
        <div className="mt-4">
          {!showCodeInput ? (
            <button
              onClick={() => setShowCodeInput(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-2 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <Tag size={14} />
              Have a promo code?
            </button>
          ) : promoSuccess ? (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
              <p className="text-sm font-bold text-green-700">Code applied!</p>
              <p className="text-xs text-green-600 mt-0.5">30 days of Premium unlocked.</p>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setPromoError(null); }}
                  placeholder="Enter code"
                  style={{ fontSize: '16px' }}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  onClick={async () => {
                    if (!promoCode.trim()) return;
                    setPromoLoading(true);
                    setPromoError(null);
                    const err = await onRedeemCode(promoCode);
                    setPromoLoading(false);
                    if (err) {
                      setPromoError(err);
                    } else {
                      setPromoSuccess(true);
                    }
                  }}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-brand-600 transition-colors"
                >
                  {promoLoading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
                  ) : 'Apply'}
                </button>
              </div>
              {promoError && (
                <p className="text-xs text-red-600 mt-1.5 px-1">{promoError}</p>
              )}
            </div>
          )}
        </div>
        </>)}

        {/* Trust signals */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Shield size={12} />
          <span>Secure payment · Cancel anytime · Restore purchases</span>
        </div>

        {/* Legal links — required by App Store Guideline 3.1.2 */}
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-gray-400">
          <a
            href="https://vectorfootball.co.uk/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 transition-colors"
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="https://vectorfootball.co.uk/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 transition-colors"
          >
            Terms of Use
          </a>
        </div>
      </div>
    </div>
  );
}
