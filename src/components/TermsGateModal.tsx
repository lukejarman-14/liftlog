import { useState } from 'react';

interface TermsGateModalProps {
  onAccept: () => void;
}

/**
 * Blocking full-screen modal shown to existing users who have not yet accepted
 * the updated Terms of Use and Privacy Policy. Cannot be dismissed without
 * ticking the checkbox and pressing Accept.
 *
 * Shown when: userProfile exists but termsAcceptedAt is missing.
 */
export function TermsGateModal({ onAccept }: TermsGateModalProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-[500] bg-gray-50 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mb-5 mx-auto shadow-md">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-2">
          Updated Terms &amp; Privacy Policy
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          We've updated our Terms of Use and Privacy Policy. Please review and accept them to continue using Vector Football.
        </p>

        {/* What changed summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Key updates include</p>
          {[
            'Payment terms for web subscriptions (Stripe)',
            'Your consumer rights by country (UK, EU, US, AU)',
            'Age requirements and parental consent rules',
            'How we store and protect your training data',
            'Your right to analytics opt-out (GDPR / CCPA)',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-brand-500 font-bold text-xs mt-0.5 flex-shrink-0">✓</span>
              <p className="text-xs text-gray-600 leading-snug">{item}</p>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="flex gap-3 mb-5">
          <button
            type="button"
            onClick={() => window.open('/terms/', '_blank')}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
          >
            Terms of Use ↗
          </button>
          <button
            type="button"
            onClick={() => window.open('/privacy/', '_blank')}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
          >
            Privacy Policy ↗
          </button>
        </div>

        {/* Checkbox */}
        <label className="flex gap-3 items-start cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-brand-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 leading-snug">
            I have read and agree to the{' '}
            <button type="button" onClick={() => window.open('/terms/', '_blank')} className="text-brand-600 underline font-medium">
              Terms of Use
            </button>
            {' '}and{' '}
            <button type="button" onClick={() => window.open('/privacy/', '_blank')} className="text-brand-600 underline font-medium">
              Privacy Policy
            </button>.
          </span>
        </label>

        {/* Accept button */}
        <button
          onClick={() => { if (agreed) onAccept(); }}
          disabled={!agreed}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all ${
            agreed
              ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Accept &amp; Continue
        </button>

        <p className="text-[10px] text-gray-400 text-center mt-3 leading-snug">
          You must accept to use Vector Football. By accepting you confirm you are 13 or older (or have parental consent if under 16).
        </p>
      </div>
    </div>
  );
}
