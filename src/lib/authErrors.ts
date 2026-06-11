export function getFriendlyAuthError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You are offline. Connect to Wi-Fi or mobile data, then try again.';
  }

  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();

  if (msg.includes('too_many_attempts') || msg.includes('rate limit') || msg.includes('rate_limited')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('email_unconfirmed')) {
    return 'Your email is not confirmed yet. Check your inbox, tap the confirmation link, then try again.';
  }

  if (
    msg.includes('invalid login') ||
    msg.includes('invalid credentials') ||
    msg.includes('invalid email or password')
  ) {
    return 'Email or password is incorrect.';
  }

  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered')) {
    return 'An account already exists for this email. Use Log In instead.';
  }

  if (msg.includes('captcha') || msg.includes('verification')) {
    return 'Security verification did not finish. Wait a moment, then try again.';
  }

  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) {
    return 'The server could not be reached. Check your connection and try again.';
  }

  if (msg.includes('password')) {
    return 'Password update failed. Check the password requirements and try again.';
  }

  return fallback;
}
