const STAY_LOGGED_IN_KEY = 'vf_stay_logged_in';
const REMEMBERED_EMAIL_KEY = 'vf_remembered_email';

function normaliseEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function rememberLogin(email?: string | null, _userId?: string | null): void {
  try {
    localStorage.setItem(STAY_LOGGED_IN_KEY, '1');
    const normalised = normaliseEmail(email);
    if (normalised) localStorage.setItem(REMEMBERED_EMAIL_KEY, normalised);
  } catch {
    // Storage can fail in private mode. Auth still works for the current session.
  }
}

export function forgetRememberedLogin(): void {
  try {
    localStorage.setItem(STAY_LOGGED_IN_KEY, '0');
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function shouldRestoreRememberedLogin(email?: string | null): boolean {
  try {
    if (localStorage.getItem(STAY_LOGGED_IN_KEY) !== '1') return false;
    const rememberedEmail = normaliseEmail(localStorage.getItem(REMEMBERED_EMAIL_KEY));
    const currentEmail = normaliseEmail(email);
    return !rememberedEmail || !currentEmail || rememberedEmail === currentEmail;
  } catch {
    return false;
  }
}
