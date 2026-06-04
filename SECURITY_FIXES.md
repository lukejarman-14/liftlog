# Security hardening — reward-system & input fixes

This batch closes the exploitable holes found in the attacker review. The
**data layer was already strong** (RLS, auth, rate-limited edge functions); the
gaps were in the **reward systems** (referrals, promo, squad-join), which are
live and grant the thing you sell.

Severity recap (calibrated to: public web + iOS, premium = on-device only,
referrals/promo live, Stripe live with 0 customers):

| # | Hole | Was | Now |
|---|------|-----|-----|
| 1 | Referral farming (self-referral via REST, multi-referral, throwaway accounts) | client-only guard | DB CHECK + unique index + RLS gate + email-confirmed + per-referrer cap |
| 2 | Promo brute-force (client-only rate limit, table enumerable) | client-side | server-side RPC, rate-limited, `promo_codes` SELECT removed |
| 3 | Team-code enumeration → free premium | no server rate limit | RPC rate-limited + email-confirmed + seat cap + in version control |
| 4 | localStorage premium spoof | n/a | **accepted** (on-device features only — see below) |
| 5 | `join_squad` not in version control | hand-made | now a migration, `search_path` pinned |

---

## 1. Apply the migrations (Supabase → SQL Editor, in order)

Run each file's contents once. They are non-destructive (use `NOT VALID`,
`IF NOT EXISTS`, `CREATE OR REPLACE`).

1. `supabase/migrations/009_referrals_hardening.sql`
2. `supabase/migrations/010_promo_redemption_rpc.sql`
3. `supabase/migrations/011_join_squad_hardening.sql`

**⚠️ Before 011 on production:** the original `join_squad` was hand-made and not
in version control. The new version matches the call contract in
`src/lib/teams.ts` (`rpc('join_squad', { p_code })` → `(coach_id, tier)`), but
confirm `squad_members` has columns `(coach_id uuid, player_id uuid)` with any
other columns defaulted, and test the join flow on a Supabase branch first.

Each migration ends with a **VERIFICATION** block and a **DOWN (rollback)**
block.

If 009's unique index or 011's unique index errors, you have pre-existing
duplicate rows — run the diagnostic query in the comment, clean up, re-run.

---

## 2. Code changes (already committed)

- **`src/lib/validation.ts`** — central, emoji-safe validation (codepoint
  length counting, allowlist sanitisers, graceful-429 helper). 25 unit tests in
  `src/lib/__tests__/validation.test.ts`.
- **`src/lib/promoCodes.ts`** — redemption now calls the `redeem_promo_code`
  RPC; no direct table read. Local cache/rate-limit kept as UX only.
- **`src/hooks/usePremium.ts`** — friendly messages for the new server reasons
  (`email_unconfirmed`, `rate_limited`).
- **Edge functions** (`create-checkout-session`, `create-portal-session`) —
  POST-only guard, field whitelist, `Retry-After: 3` on 429 (from the prior
  hardening batch).

Emoji: names and free-text fields accept emoji and count them as single
characters; codes and emails strip them via allowlist regexes. Verified by test.

---

## 3. Dashboard steps you must do manually (cannot be done in code)

- [ ] **Rotate promo codes to long random strings.** Short words like
  `VECTORVIP` are guessable. In SQL Editor:
  ```sql
  -- example: a 16-char random code
  INSERT INTO public.promo_codes (code, active)
  VALUES (upper(translate(encode(gen_random_bytes(12),'base64'),'+/=','XYZ')), true);
  -- then deactivate the old guessable ones:
  UPDATE public.promo_codes SET active = false WHERE code IN ('VECTORVIP');
  ```
- [ ] **Enable signup bot protection.** Supabase → Authentication → Settings →
  enable CAPTCHA (hCaptcha/Turnstile). Then pass the token client-side:
  `supabase.auth.signUp({ email, password, options: { captchaToken } })`.
  This defangs referral/promo/squad farming at the source (free account
  creation is the enabler for all three).
- [ ] **Stripe Radar** — enable when you move to a paid Stripe plan. Not urgent
  at 0 customers; your checkout is auth-gated + per-user rate-limited, so it is
  not a scrape-able public payment link.

---

## 4. Accepted / deferred risks (deliberate, documented)

- **localStorage premium spoof (web).** Because premium unlocks only on-device
  features, a DevTools edit of `vf_premium` grants free premium but steals no
  data and costs no server resources. This **cannot be fully prevented** in a
  public web SPA — the only real fix is moving genuinely valuable logic
  server-side. Accepted for now; revisit if a premium feature ever consumes a
  paid API.
- **Client-side SHA-256 `hashPassword`.** Only used in the non-Supabase local
  fallback and stripped before cloud sync (`cloudSync.ts`). Never stored
  server-side in production. Low risk; optional to remove entirely.

---

## 5. Quick verification after applying

```sql
-- helper exists and reports confirmation status
SELECT public.is_email_confirmed();

-- promo table no longer client-readable (run as authenticated, not service role)
SELECT * FROM public.promo_codes;            -- expect 0 rows

-- promo redemption works, second attempt is blocked
SELECT public.redeem_promo_code('<a-real-active-code>');

-- triggers in place
SELECT tgname FROM pg_trigger
WHERE tgrelid IN ('public.referrals'::regclass, 'public.squad_members'::regclass);

-- SECURITY DEFINER functions have search_path pinned
SELECT proname, proconfig FROM pg_proc
WHERE proname IN ('is_email_confirmed','redeem_promo_code','join_squad',
                  'enforce_referral_cap','enforce_squad_seat_cap');
```

Client: `npm run build` (clean) · `npm test` (132 passing).
