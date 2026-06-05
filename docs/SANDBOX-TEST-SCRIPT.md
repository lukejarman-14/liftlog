# Sandbox Test Script — verify billing + entitlements before going live

Run this AFTER Stage 3 (migrations 012–020 run, functions deployed, `main` merged).
Goal: prove the new server-authoritative entitlement system works on BOTH web
(Stripe) and iOS (RevenueCat) before real customers exist. ~30 min.

A test "passes" only if BOTH the app unlocks AND the server agrees. To check the
server at any point, run this in the Supabase SQL editor as the test user, or just
confirm the app reflects it after a refresh:
```sql
-- as the signed-in user (anon key + their JWT), not service role:
select * from public.entitlements where user_id = auth.uid();
select public.get_my_entitlement();
```

---

## 0. Prerequisites (tick before starting)
- [ ] Paid Apps Agreement signed; IAP products live in App Store Connect.
- [ ] RevenueCat offering has `$rc_monthly / $rc_annual / $rc_lifetime` → entitlement `vectorfootball.co.uk Pro`.
- [ ] Stripe is in **Test mode**; the webhook + the 3 functions are deployed.
- [ ] A Stripe test card ready: `4242 4242 4242 4242`, any future expiry, any CVC.
- [ ] An App Store **Sandbox tester** Apple ID (Settings → App Store → Sandbox Account on the device).

---

## 1. WEB — Stripe (do on vectorfootball.co.uk)

### 1a. New-user trial
- [ ] Sign up a fresh test account.
- [ ] Tap a premium feature → start the 30-day trial.
- [ ] **Expect:** premium unlocks. `get_my_entitlement()` → `source:"trial"`, `has_access:true`.
- [ ] `entitlements.trial_started_at` is now set (this is what blocks repeat trials).

### 1b. Purchase each plan (Monthly, Annual, Lifetime — one test account each is cleanest)
- [ ] Paywall → pick plan → Stripe Checkout → pay with `4242…`.
- [ ] Return to app. Within ~10s premium shows as active.
- [ ] **Expect:** `entitlements` row `is_premium=true`, correct `plan`, `source:"stripe"`, future `current_period_end` (null for lifetime).

### 1c. Repeat-trial + duplicate-sub guards
- [ ] With an active subscription, try to checkout again → **Expect:** blocked ("already have an active subscription", HTTP 409).
- [ ] On an account whose trial already started, start a new sub → **Expect:** NO second free trial (charged immediately / no trial line).

### 1d. Cancel / revoke
- [ ] Cancel the subscription in the Stripe **test** dashboard (or let it expire with test clock).
- [ ] **Expect:** webhook fires → `entitlements.is_premium=false` → app loses premium on next refresh. Lifetime must NOT be revoked.

---

## 2. iOS — RevenueCat sandbox (on a real device/TestFlight build)

- [ ] Sign in with the Sandbox tester Apple ID.
- [ ] Paywall → buy a plan → complete the sandbox purchase sheet.
- [ ] **Expect:** premium unlocks; the RevenueCat webhook writes an `entitlements` row with `source:"revenuecat"` and the right `plan`.
- [ ] Force-close + reopen → premium persists (read from server, not just local).
- [ ] **Restore Purchases** on a second sandbox sign-in → access returns.

---

## 3. Abuse checks (the security payoff)

- [ ] **Local spoof:** in web dev tools, set `localStorage.vf_premium = {"isPremium":true}` → reload.
      On-device UI may look unlocked, BUT:
  - [ ] A coach/club account must **NOT** be able to publish a "Pro" squad from a spoof —
        `register_squad` reads real payment. Verify a joined player does NOT inherit premium.
- [ ] **Billing portal:** confirm you can only open YOUR OWN Stripe portal (no IDOR).
- [ ] **Unknown RC product:** (if you can) an unrecognized product id must NOT grant premium.

---

## 4. Auth / shared-device (quick)
- [ ] Signup, login, password reset, change password (asks for current password), with CAPTCHA on.
- [ ] Log in as User A, log out, log in as User B on the same browser →
      **Expect:** B never sees A's profile/premium/squad.

---

## If anything fails
- Flip the Supabase CAPTCHA toggle / Stripe back to safe state, revert the `main`
  merge if needed (migrations have DOWN sections), and tell Claude the exact error +
  what `get_my_entitlement()` returned. Most failures at this stage are config
  (Paid Apps Agreement, RevenueCat offering, webhook secret), not code.
