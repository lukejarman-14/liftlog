/**
 * CookieBanner — GDPR cookie consent notice.
 *
 * Only shown on web (not in Capacitor native — iOS App Store handles consent
 * separately). Remembers the choice in localStorage so it only ever shows once.
 *
 * "Accept" → PostHog tracking on.
 * "Necessary only" → PostHog tracking off (analytics opt-out).
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { applyAnalyticsOptOut } from '../lib/analytics';

const CONSENT_KEY = 'vf_cookie_consent';

type Consent = 'accepted' | 'declined';

function getStored(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch { /* ignore */ }
  return null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  // On mount: apply any stored preference, show banner if none yet
  useEffect(() => {
    // Native apps don't need a cookie banner
    if (Capacitor.isNativePlatform()) return;

    const stored = getStored();
    if (stored) {
      applyAnalyticsOptOut(stored === 'declined');
      return;
    }
    // Small delay so banner doesn't flash in before the app shell paints
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    applyAnalyticsOptOut(false);
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    applyAnalyticsOptOut(true);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-5"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="max-w-xl mx-auto bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Text */}
        <p className="text-sm text-gray-300 flex-1 leading-relaxed">
          We use analytics cookies to understand how the app is used — nothing sold, nothing shared.{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
          >
            Privacy policy
          </a>
          .
        </p>

        {/* Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm rounded-xl border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
          >
            Necessary only
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
