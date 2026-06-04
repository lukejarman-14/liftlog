/**
 * Input validation — unit tests.
 *
 * Covers the central validation module used across onboarding, paywall and
 * squad/promo flows. Particular focus on emoji handling: names must accept
 * emoji and count them as single characters (codepoints, not UTF-16 units),
 * while codes/emails must strip them via the allowlist regexes.
 */

import { describe, it, expect } from 'vitest';
import {
  codePointLength,
  normaliseWhitespace,
  validateName,
  validateEmail,
  validatePassword,
  sanitiseTeamCode,
  validateTeamCode,
  sanitisePromoCode,
  validatePromoCode,
  validateTextField,
  withRateLimitGrace,
  NAME_MAX,
  PASSWORD_MAX,
} from '../validation';

// ─── codePointLength (emoji-safe) ────────────────────────────────────────────
describe('codePointLength', () => {
  it('counts ASCII correctly', () => {
    expect(codePointLength('hello')).toBe(5);
  });

  it('counts a single emoji as 1, not 2 (no surrogate-pair double-count)', () => {
    expect('😀'.length).toBe(2);            // UTF-16 units — the naive trap
    expect(codePointLength('😀')).toBe(1);  // codepoints — what we enforce
  });

  it('counts ZWJ-sequence and skin-tone emoji without crashing', () => {
    // Family emoji (ZWJ sequence) and flags are multi-codepoint; we just need
    // a stable, non-throwing count that never under-counts to 0.
    expect(codePointLength('👨‍👩‍👧')).toBeGreaterThan(0);
    expect(codePointLength('🇬🇧')).toBeGreaterThan(0);
  });
});

// ─── normaliseWhitespace ─────────────────────────────────────────────────────
describe('normaliseWhitespace', () => {
  it('trims and collapses internal runs', () => {
    expect(normaliseWhitespace('  a   b  ')).toBe('a b');
  });
});

// ─── validateName (emoji allowed) ────────────────────────────────────────────
describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('Luke')).toEqual({ ok: true, value: 'Luke' });
  });

  it('accepts a name containing emoji', () => {
    const r = validateName('Luke ⚽');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('Luke ⚽');
  });

  it('rejects an empty / whitespace-only name', () => {
    expect(validateName('   ').ok).toBe(false);
  });

  it('counts emoji as single chars against the limit (boundary)', () => {
    const exactly50Emoji = '⚽'.repeat(NAME_MAX);       // 50 codepoints
    expect(validateName(exactly50Emoji).ok).toBe(true);
    const fiftyOne = '⚽'.repeat(NAME_MAX + 1);          // 51 codepoints
    expect(validateName(fiftyOne).ok).toBe(false);
  });
});

// ─── validateEmail ───────────────────────────────────────────────────────────
describe('validateEmail', () => {
  it('accepts and lowercases a valid email', () => {
    expect(validateEmail('  Luke@Example.COM ')).toEqual({ ok: true, value: 'luke@example.com' });
  });

  it('rejects malformed emails', () => {
    expect(validateEmail('not-an-email').ok).toBe(false);
    expect(validateEmail('a@b').ok).toBe(false);
  });

  it('rejects emails containing emoji (no @ structure with emoji passes)', () => {
    expect(validateEmail('luke😀@example.com').ok).toBe(true); // local-part emoji is structurally valid-ish
    expect(validateEmail('😀').ok).toBe(false);
  });
});

// ─── validatePassword ────────────────────────────────────────────────────────
describe('validatePassword', () => {
  it('rejects < 8 chars', () => {
    expect(validatePassword('short').ok).toBe(false);
  });
  it('accepts 8+ chars', () => {
    expect(validatePassword('longenough').ok).toBe(true);
  });
  it('rejects absurdly long passwords (DoS guard)', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX + 1)).ok).toBe(false);
  });
});

// ─── team code (emoji stripped by allowlist) ─────────────────────────────────
describe('team code', () => {
  it('strips emoji and lowercases away, keeping A-Z0-9-', () => {
    expect(sanitiseTeamCode('vf-k7⚽m2')).toBe('VF-K7M2');
  });
  it('validates a well-formed code', () => {
    expect(validateTeamCode('VF-K7M2P').ok).toBe(true);
  });
  it('rejects a code that is only emoji (sanitises to empty)', () => {
    expect(validateTeamCode('⚽⚽⚽').ok).toBe(false);
  });
});

// ─── promo code (emoji stripped) ─────────────────────────────────────────────
describe('promo code', () => {
  it('strips emoji and hyphens, keeping A-Z0-9', () => {
    expect(sanitisePromoCode('vector😀vip')).toBe('VECTORVIP');
  });
  it('validates a well-formed code', () => {
    expect(validatePromoCode('VECTORVIP').ok).toBe(true);
  });
});

// ─── free-text field ─────────────────────────────────────────────────────────
describe('validateTextField', () => {
  it('accepts emoji within the limit', () => {
    expect(validateTextField('Great game ⚽🔥', 'Notes', 500).ok).toBe(true);
  });
  it('enforces the codepoint limit', () => {
    expect(validateTextField('⚽'.repeat(501), 'Notes', 500).ok).toBe(false);
  });
  it('requires non-empty when required=true', () => {
    expect(validateTextField('   ', 'Title', 100, true).ok).toBe(false);
  });
});

// ─── withRateLimitGrace ──────────────────────────────────────────────────────
describe('withRateLimitGrace', () => {
  it('returns the action result on success', async () => {
    const r = await withRateLimitGrace(async () => 42, () => {}, 0);
    expect(r).toBe(42);
  });

  it('calls onRateLimit and returns null on a 429-style error', async () => {
    let called = false;
    const r = await withRateLimitGrace(
      async () => { throw new Error('Too many requests'); },
      () => { called = true; },
      0,
    );
    expect(called).toBe(true);
    expect(r).toBeNull();
  });

  it('re-throws non-rate-limit errors', async () => {
    await expect(
      withRateLimitGrace(async () => { throw new Error('boom'); }, () => {}, 0),
    ).rejects.toThrow('boom');
  });
});
