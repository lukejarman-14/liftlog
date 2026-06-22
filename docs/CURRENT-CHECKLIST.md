# Vector Football — Current Checklist
_Last updated: 6 Jun 2026_

---

## 🐛 Bugs To Fix

- [ ] **Email confirmation re-send broken** — User enters wrong email at sign-up, edits it, presses "Send Email Confirmation" → email never arrives. Only works on first attempt. Fix: investigate `cloudResendConfirmation` in `src/lib/cloudSync.ts` and the email confirmation flow.

---

## 🔴 Must Do (App Store / Launch)

- [ ] Fresh build → `npm run build` → `npx cap sync ios` → Xcode Archive → upload to App Store Connect
- [ ] TestFlight purchase test — all 3 IAPs (Monthly, Annual £79.99, Lifetime £150)
- [ ] Confirm RevenueCat API key in `.env.local` matches RC dashboard (Apps → Vector Football → Show key)
- [ ] Add HealthKit review notes in App Review Information (Home → Daily Readiness → Start → Autofill from Apple Health)
- [ ] Resubmit to App Store (Resolution Center)
- [ ] Set up Sandbox Tester (App Store Connect → Users and Access → Sandbox → Testers)
- [ ] Add TestFlight testers to "Summer Locked In" group

---

## 🟡 Security / Deploy Gate

- [ ] Merge `security-only` → `main` (Netlify deploy)
- [ ] Run migrations 012–020 in Supabase SQL editor
- [ ] Deploy edge functions: `stripe-webhook`, `create-portal-session`, `revenuecat-webhook`
- [ ] Set `REVENUECAT_WEBHOOK_AUTH` secret in Supabase
- [ ] Configure RevenueCat dashboard webhook URL
- [ ] Add `VITE_HCAPTCHA_SITE_KEY` to Netlify environment variables
- [ ] Verify billing flows in Stripe test-mode + RevenueCat sandbox before going live
- [ ] Fix CI workflow path (via GitHub web UI) — see `docs/ci-workflow-fixed.yml`
- [ ] Rotate GitHub PAT (was exposed in remote URL)
- [ ] Sentry CSP fix — merge commit `65af3f7` (security-only → main)

---

## 🟡 Blocked / Needs Input

- [ ] `player_profiles` schema — run: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='player_profiles';` → send output so migration 008 + baseline can be fixed
- [ ] ONE trial length decision — 14 / 21 / 30 days / Aug 1? Update all copy once decided
- [ ] Coach vs Club Stripe product mapping decision
- [ ] Reactivate or remove promo code `APPLEREVIEW2026` in App Review notes

---

## 🔵 Longer Term

- [ ] iOS device re-test: hCaptcha signup + login on device
- [ ] Rate my app modal — test triggers after 5 completed sessions
- [ ] Solicitor review — privacy policy (health data + children's provisions) before EU/US scaling
- [ ] Supabase upgrade to Pro when approaching 500+ active users
- [ ] Load testing when 1,000+ users (k6 against Supabase URL)
- [ ] Coach Tier feature — see `docs/coach-tier-ideas.md`

---

_Add items below this line:_

