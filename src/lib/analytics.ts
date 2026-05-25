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

const key  = import.meta.env.VITE_POSTHOG_KEY  as string | undefined;
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

/** Fire a named analytics event with optional properties. No-ops if PostHog key not set. */
export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!key) return;
  posthog.capture(eventName, properties);
}

/**
 * Tie subsequent events to a known user identity.
 * Call this after a successful login or sign-up.
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!key) return;
  posthog.identify(userId, traits);
}

/** Call on logout so the next session starts as a fresh anonymous user. */
export function resetAnalyticsUser(): void {
  if (!key) return;
  posthog.reset();
}
