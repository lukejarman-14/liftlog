/**
 * Sentry — Production error monitoring for Vector Football.
 *
 * Setup:
 *  1. Create a free account at https://sentry.io
 *  2. Create a new project → React
 *  3. Copy your DSN and add it to .env.local:
 *     VITE_SENTRY_DSN=https://xxxxx@oxxxxx.ingest.sentry.io/xxxxxxx
 *  4. Sentry will now catch all unhandled errors and report them to your dashboard.
 *
 * Usage anywhere in the app:
 *  import { captureError } from './lib/sentry';
 *  captureError(err, { context: 'formation save', userId });
 */

import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initialiseSentry() {
  if (!DSN) {
    if (import.meta.env.DEV) console.info('[Sentry] No DSN set — skipping init (add VITE_SENTRY_DSN to .env.local)');
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE, // 'production' | 'development'
    // Only send errors in production — avoids noise during development
    enabled: import.meta.env.PROD,
    // Capture 10% of sessions for performance tracing (free tier friendly)
    tracesSampleRate: 0.1,
    // Release tracking — helps identify which deploy introduced a bug
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    // Don't send personal data
    beforeSend(event) {
      // Strip any email addresses from breadcrumbs just in case
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

/**
 * Manually capture an error with optional context.
 * Use this in catch blocks for important operations (payments, auth, saves).
 */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!DSN || import.meta.env.DEV) return;
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

/**
 * Set the current user so errors are linked to their account in Sentry.
 * Call this after successful login. Pass null to clear on logout.
 */
export function setSentryUser(userId: string | null) {
  if (!DSN) return;
  if (userId) {
    Sentry.setUser({ id: userId }); // ID only — no email for privacy
  } else {
    Sentry.setUser(null);
  }
}

// Export Sentry's ErrorBoundary for use in App.tsx
export const SentryErrorBoundary = Sentry.ErrorBoundary;
