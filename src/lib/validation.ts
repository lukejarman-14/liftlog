/**
 * Central input validation and sanitisation for Vector Football.
 *
 * Rules:
 * - Sanitise before storing, not after reading.
 * - All limits match the DB-level CHECK constraints in migration 008.
 * - Emoji are valid in display names; they are stripped from codes/emails
 *   by the regex allowlists, not by a blanket unicode ban.
 * - char_length() in Postgres counts unicode codepoints, so a 4-byte emoji
 *   counts as 1 character — the same way these JS length checks count them
 *   via the spread operator trick (avoids surrogate-pair off-by-one).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count unicode codepoints (not UTF-16 code units) — handles emoji correctly. */
export function codePointLength(s: string): number {
  return [...s].length;
}

/** Strip leading/trailing whitespace and collapse internal runs to one space. */
export function normaliseWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Field schemas — each returns { ok: true, value } | { ok: false, error }
// ---------------------------------------------------------------------------

type OK<T>  = { ok: true;  value: T };
type Err    = { ok: false; error: string };
type Result<T> = OK<T> | Err;

function ok<T>(value: T): OK<T>   { return { ok: true, value }; }
function err(error: string): Err  { return { ok: false, error }; }

// --- Name (firstName / lastName / displayName) ----------------------------

/** Max display-name length in codepoints — matches DB CHECK constraint. */
export const NAME_MAX = 50;

export function validateName(raw: string, label = 'Name'): Result<string> {
  const v = normaliseWhitespace(raw);
  if (v.length === 0)            return err(`${label} is required.`);
  if (codePointLength(v) > NAME_MAX)
    return err(`${label} must be ${NAME_MAX} characters or fewer.`);
  return ok(v);
}

// --- Email ----------------------------------------------------------------

/** RFC 5321 max email length. */
export const EMAIL_MAX = 254;

export function validateEmail(raw: string): Result<string> {
  const v = raw.trim().toLowerCase();
  if (v.length === 0)             return err('Email is required.');
  if (v.length > EMAIL_MAX)       return err('Email address is too long.');
  // Basic structure check — Supabase does the full RFC validation server-side.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return err('Enter a valid email address.');
  return ok(v);
}

// --- Password -------------------------------------------------------------

/**
 * Max password length — bcrypt silently truncates at 72 bytes.
 * Capping at 128 chars prevents CPU-exhaustion with very long inputs
 * while still allowing strong passphrases.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function validatePassword(raw: string): Result<string> {
  if (raw.length < PASSWORD_MIN)
    return err(`Password must be at least ${PASSWORD_MIN} characters.`);
  if (raw.length > PASSWORD_MAX)
    return err(`Password must be ${PASSWORD_MAX} characters or fewer.`);
  return ok(raw);
}

// --- Team / squad code ---------------------------------------------------

/** Alphanumeric + hyphens only; 3–20 chars. Emoji stripped by regex allowlist. */
export const TEAM_CODE_MAX = 20;
export const TEAM_CODE_REGEX = /^[A-Z0-9-]{3,20}$/;

export function sanitiseTeamCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, TEAM_CODE_MAX);
}

export function validateTeamCode(raw: string): Result<string> {
  const v = sanitiseTeamCode(raw);
  if (!TEAM_CODE_REGEX.test(v))
    return err('Team code must be 3–20 uppercase letters, numbers, or hyphens.');
  return ok(v);
}

// --- Promo code ----------------------------------------------------------

export const PROMO_CODE_MAX = 20;
export const PROMO_CODE_REGEX = /^[A-Z0-9]{3,20}$/;

export function sanitisePromoCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PROMO_CODE_MAX);
}

export function validatePromoCode(raw: string): Result<string> {
  const v = sanitisePromoCode(raw);
  if (!PROMO_CODE_REGEX.test(v))
    return err('Promo code must be 3–20 uppercase letters or numbers.');
  return ok(v);
}

// --- Announcement / free-text fields ------------------------------------

export const ANNOUNCEMENT_MAX  = 500;
export const COACH_NOTES_MAX   = 2000;
export const SCHEDULE_LABEL_MAX = 100;
export const SCHEDULE_DESC_MAX  = 300;
export const MATCH_OPPONENT_MAX = 100;
export const MATCH_NOTES_MAX    = 1000;

export function validateTextField(
  raw: string,
  label: string,
  max: number,
  required = false,
): Result<string> {
  const v = normaliseWhitespace(raw);
  if (required && v.length === 0) return err(`${label} is required.`);
  if (codePointLength(v) > max)
    return err(`${label} must be ${max} characters or fewer.`);
  return ok(v);
}

// ---------------------------------------------------------------------------
// Graceful 429 handler
// ---------------------------------------------------------------------------

/**
 * Wraps a rate-limited async action.
 * If the action throws a 429 / rate-limit error, waits `delayMs` (default 2900ms)
 * then calls `onRateLimit` — letting the UI show a friendly message instead of
 * crashing.
 */
export async function withRateLimitGrace<T>(
  action: () => Promise<T>,
  onRateLimit: (retryAfterMs: number) => void,
  delayMs = 2900,
): Promise<T | null> {
  try {
    return await action();
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
      onRateLimit(delayMs);
      return null;
    }
    throw e;
  }
}
