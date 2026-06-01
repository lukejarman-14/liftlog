/**
 * Analytics — PostHog implementation.
 *
 * Required env vars (add to .env.local):
 *   VITE_POSTHOG_KEY   — Project API Key from PostHog (phc_...)
 *   VITE_POSTHOG_HOST  — Cloud region: https://us.i.posthog.com  OR  https://eu.i.posthog.com
 *
 * Usage anywhere in the app:  trackEvent('event_name', { key: 'value' })
 * Identify a user after login: identifyUser(userId, { email: '...' })
 * Reset on logout:             resetAnalyticsUser()
 */

import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

if (key) {
  posthog.init(key, {
    api_host: host ?? 'https://us.i.posthog.com',
    // SPA — don't auto-fire a pageview on init; we control navigation events
    capture_pageview: false,
    // Capacitor WKWebView has localStorage; don't fall back to cookies
    persistence: 'localStorage',
    // Don't autocapture raw DOM clicks — we fire precise named events instead
    autocapture: false,
    // Disable session recording until you explicitly enable it in PostHog UI
    disable_session_recording: true,
  });
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!key) return;
  posthog.capture(eventName, properties);
}

function fnv1a64(str: string): string {
  let hash = BigInt('0xcbf29ce484222325');
  const prime = BigInt('0x100000001b3');
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(36);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!key) return;
  const anonymousId = `vf_${fnv1a64(userId)}`;
  posthog.identify(anonymousId, traits);
}

export function resetAnalyticsUser(): void {
  if (!key) return;
  posthog.reset();
}

/**
 * Apply the user's analytics preference (GDPR / CCPA opt-out).
 * Call on app boot and whenever the setting changes.
 * PostHog persists the opt-out choice in its own localStorage key,
 * so trackEvent() is automatically suppressed when opted out.
 */
export function applyAnalyticsOptOut(optOut: boolean): void {
  if (!key) return;
  if (optOut) {
    posthog.opt_out_capturing();
  } else {
    posthog.opt_in_capturing();
  }
}
