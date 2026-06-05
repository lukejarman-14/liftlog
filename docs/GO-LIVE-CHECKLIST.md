# Vector Football — Go-Live Checklist

Consolidated from the security hardening + the Apple rejection (build 1.0(14)).
Last updated: 2026-06-05.

**Status:** all code/security fixes are written, tested (132 tests pass), and pushed to
the `security-only` branch (~20 commits ahead of `main`). They are NOT live yet.
Everything below is the manual work to get them live + clear the App Store rejection.

> Context: ~0 customers, so the deploy window is low-risk. Do Stage 3 as one
> coordinated cutover (DB + functions + web together — they're designed as a set).

---

## ⏱️ TONIGHT — fastest path to clear the Apple rejection (no Terminal / Docker / new build)

The two rejections do NOT need the security deploy, Docker, or a new binary.
- ❌ Do NOT install Docker / do the schema dump — irrelevant to Apple, time sink.
- [ ] **Sign the Paid Apps Agreement** (App Store Connect → Business → Agreements) → fixes IAP (2.1b).
- [ ] Confirm 3 IAP products are "Ready to Submit" + in the RevenueCat offering (this is the real time sink if not done).
- [ ] **Resubmit the EXISTING build** (14) via Resolution Center with review notes for HealthKit (2.5.1):
      *"Paid Apps Agreement now active; IAP configured. HealthKit: Home tab → Daily Readiness card → Start → Autofill from Apple Health."*
- The HealthKit feature already exists in build 14 — notes can clear 2.5.1 without a rebuild.
- The security hardening + HealthKit label polish ship in the NEXT build, AFTER sandbox testing — NOT tonight (rushing untested billing breaks it).

---

## STAGE 1 — Un-reject the App Store  (start here, can run in parallel)

### IAP rejection (Guideline 2.1b) — this is CONFIG, not code
- [ ] **Sign the Paid Apps Agreement** — App Store Connect → Business → Agreements.
      *Without this, no purchase works. This alone likely clears the rejection.*
- [ ] Confirm IAP products in App Store Connect: Monthly £7.99, Annual £79.99,
      Lifetime £150 (+ Coach/Club if sold on iOS) — full metadata, "Ready to Submit",
      attached to the app version.
- [ ] RevenueCat: products imported → added to the **current Offering** with package
      ids `$rc_monthly`, `$rc_annual`, `$rc_lifetime` → attached to entitlement
      `vectorfootball.co.uk Pro`.
- [ ] Create a Sandbox tester (ASC → Users and Access → Sandbox → Testers).

### HealthKit rejection (Guideline 2.5.1) — code FIXED (commit b763a11)
- [ ] Add App Review notes: *"HealthKit: Home tab → 'Daily Readiness' card → Start →
      'Autofill from Apple Health'."*
      *(The home card now shows "Syncs with Apple Health" so it's clearly identified.)*

---

## STAGE 2 — Pre-deploy setup (accounts/config)

- [ ] Netlify env: add `VITE_HCAPTCHA_SITE_KEY` (public key from `.env.local`).
- [ ] Set `REVENUECAT_WEBHOOK_AUTH` (a strong secret) on the Supabase functions.
- [ ] RevenueCat dashboard: add a Webhook → URL
      `https://<project>.supabase.co/functions/v1/revenuecat-webhook` + the same
      Authorization secret. Confirm product ids match `planForProduct()`.
- [ ] Fix CI: in GitHub, delete the broken nested `.github/workflows/.github/workflows/ci.yml`
      and create `.github/workflows/ci.yml` from `docs/ci-workflow-fixed.yml`.
      (Or grant your token the `workflow` scope and ask Claude to push it.)

---

## STAGE 3 — Coordinated deploy (do these close together)

- [ ] Run migrations in the Supabase SQL editor IN ORDER:
      `012, 013, 014, 015, 016, 017, 018, 019, 020`
- [ ] `supabase functions deploy stripe-webhook create-portal-session revenuecat-webhook`
- [ ] Merge `security-only` → `main` (Netlify auto-deploys the website).
      *DB + functions + web must update together — the new webhook/entitlement code
      replaces the old client paths.*

---

## STAGE 4 — Test before trusting it (DO NOT SKIP)

- [ ] **Stripe test-mode + RevenueCat sandbox payment test:**
      buy each plan → premium unlocks → cancel → access removed.
- [ ] Confirm a coach squad only becomes "Pro" with a REAL payment (not by editing localStorage).
- [ ] Confirm a second checkout is blocked while a subscription is active, and the
      30-day trial is only offered once per user.
- [ ] **Auth test (web + iOS):** signup, login, password reset/change, account switch
      on a shared device — with CAPTCHA on.
- [ ] If anything breaks: revert the `main` merge; migrations 012–020 are mostly
      additive (each has a DOWN section).

---

## STAGE 5 — Ship iOS

- [ ] Rebuild from `main`: `npm ci` → `npm run build` → `npx cap sync ios`
      → bump build number in Xcode → archive → upload.
- [ ] Resubmit to Apple with the Stage 1 review notes.
- [ ] Do NOT reuse the old build-3/14 archive.

---

## STAGE 6 — Two inputs for Claude (unblocks the last work)

- [ ] Paste the `player_profiles` schema → Claude finishes coach-notes ownership,
      migration 008 fix, and a clean `supabase db reset` baseline:
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='player_profiles';`
- [ ] Decide ONE trial length (recommended: **30 days/user**) → Claude aligns every
      screen, term, paywall, and Stripe/RevenueCat config.

---

## STAGE 7 — Security housekeeping

- [ ] Rotate your GitHub Personal Access Token (it was stored in plaintext in your git
      remote URL and surfaced in a session). Switch to a credential helper.
- [ ] (Later, paid Stripe plan) enable Stripe Radar.

---

## What Claude builds AFTER your Stage 4 test passes (not manual)

Built on the *verified* payment foundation, so it's safe:
- Authoritatively revoke squad-derived premium (reconcile-down, not upgrade-only).
- Move promo/referral grants fully server-side (portable across devices).
- Coach-vs-Club product mapping + true Club 200-seat tier.
- Webhook ordering / subscription-aware entitlement.
- Higher-entropy, rotatable squad invite tokens.
- Backend RLS/billing security test suite.

---

## Already done (no action needed — for confidence)

Server-authoritative entitlements + IDOR fix + idempotent webhooks; cross-account
data isolation; rate-limit + seat-cap lockdown; referral/promo/squad hardening;
CAPTCHA; analytics consent-first; fail-closed auth/deletion; password reauth;
CSV-injection, SW-cache, HSTS, Sentry-CSP fixes; HealthKit recency + 2.5.1 UI fix.
~30 findings across two external (Codex) reviews. All tsc/build/132 tests green.
