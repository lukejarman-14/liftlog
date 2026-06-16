# Vector Football — Launch Runbook (target: Fri 19 June 2026)

Deploys the gated `security-only` work (security hardening + server-authoritative
entitlements) to production, sandbox-tests billing, and ships. **Do the steps in
order.** The dangerous part is the entitlement cutover — the webhook + client must
go live together, and only after the migrations are run and billing is sandbox-tested.

Branch state (as of 11 Jun): `security-only` is reconciled with `main` (a clean
superset, 27 commits ahead, builds clean). It has NOT been pushed.

Remember the leverage: the **pre-season 30-day free trial runs until ~1 Aug**, so
launch day is trial-only — no one hits a paywall. Paid checkout must be *correct*
but isn't load-bearing on day one; the **entitlement system + security** are.

---

## Step 0 — Prereqs (today)
- [ ] Confirm Supabase CLI is logged in: `supabase projects list` (re-`supabase login` if not).
      Project is already linked (`supabase/.temp/project-ref` = `rcxhmlxlzxfmqfpugavg`).
- [ ] Have these to hand: RevenueCat dashboard access, Stripe dashboard (test + live),
      Supabase dashboard (SQL editor + Edge Function secrets).

## Step 1 — 🔴 Rotate the GitHub PAT, then push the branch
The token is currently embedded in the git remote URL (exposed).
- [ ] GitHub → Settings → Developer settings → Personal access tokens → **revoke** the old token, create a new one (repo scope).
- [ ] Reset the remote WITHOUT the token in the URL:
      ```
      git remote set-url origin https://github.com/lukejarman-14/liftlog.git
      ```
      (Git will prompt for credentials / use the keychain; paste the new token as the password once.)
- [ ] Back up the reconciled branch:
      ```
      git push origin security-only
      ```

## Step 2 — Supabase migrations
The early security migrations (001–014-ish) are already live via PRs #1/#2. The
**entitlement cluster (015–023) is NOT** — that's the cutover.

First, see what already exists (run in the SQL editor):
```sql
-- functions
select proname from pg_proc where proname in
 ('get_my_entitlement','has_paid_entitlement','start_trial','register_squad',
  'get_referral_owner','redeem_promo_code','check_edge_rate_limit','delete_user');
-- tables
select tablename from pg_tables where schemaname='public'
 and tablename in ('entitlements','stripe_customers','billing_events');
```
- [ ] If `entitlements`/`get_my_entitlement` are **absent**, run the migration files **in numeric order**, pasting each into the SQL editor:
      `015 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → 023`
      (Verify 012/013/014 are present too; run any that are missing first.)
- [ ] Re-run the verification query — all functions + tables should now exist.

> Note: most are `CREATE OR REPLACE` / `IF NOT EXISTS` and safe to re-run, but a few
> `DROP POLICY` / `ALTER` statements can error if already applied — that's fine, read
> the error and continue.

## Step 3 — Deploy the edge functions
These three must deploy **together** with the client (Step 6) — the webhook no longer
writes the legacy `vf_premium`, it writes the `entitlements` table.
- [ ] Confirm function secrets exist:
      ```
      supabase secrets list
      ```
      Required: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
      `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`.
- [ ] Set the RevenueCat webhook shared secret (pick a strong random value, save it):
      ```
      supabase secrets set REVENUECAT_WEBHOOK_AUTH='<strong-random-string>'
      ```
- [ ] Deploy:
      ```
      supabase functions deploy stripe-webhook
      supabase functions deploy create-portal-session
      supabase functions deploy revenuecat-webhook
      ```

## Step 4 — RevenueCat dashboard
- [ ] Project → Webhooks → add:
      - URL: `https://rcxhmlxlzxfmqfpugavg.supabase.co/functions/v1/revenuecat-webhook`
      - Authorization header = the exact `REVENUECAT_WEBHOOK_AUTH` value from Step 3.
- [ ] Confirm product identifiers map in `planForProduct()` (contain `month` / `annual`|`year` / `lifetime`).
- [ ] Confirm the iOS app sets RevenueCat `appUserID` = the Supabase user id (it does — `rcConfigure`).

## Step 5 — 🔬 Sandbox test (THE GATE — do not skip)
**Stripe (test mode):**
- [ ] New test user → start checkout → completes with a **30-day trial** (no charge).
- [ ] `select * from entitlements where user_id = '<id>'` → `is_premium=true`, `source='stripe'`, `trial_started_at` set.
- [ ] `select get_my_entitlement()` as that user → `has_access=true`.
- [ ] Cancel the sub in Stripe test → webhook → entitlement revoked (lifetime never revoked).
- [ ] Billing portal opens ONLY that user's customer (IDOR fix).
- [ ] Second checkout attempt while active → blocked ("already have a subscription"); no second trial granted.

**RevenueCat (iOS sandbox):**
- [ ] Sandbox purchase → `entitlements.source='revenuecat'`, `is_premium=true`.
- [ ] Restore purchases works; expiry revokes; unknown product is refused.

**Entitlement integrity:**
- [ ] As a free user, try to set premium locally (edit `vf_premium`) then publish a squad →
      squad tier stays `free` (server `register_squad` ignores client). Players do NOT inherit premium.
- [ ] Squad-inherited premium only when the coach has a **real paid** entitlement.

## Step 6 — Ship to production (web + functions together)
Functions are already live from Step 3. Now the client:
- [ ] Open a PR `security-only → main` (or merge locally) and push `main`:
      ```
      git push origin security-only            # if not already
      # via GitHub: open PR security-only -> main, merge
      # OR locally:
      git checkout main && git merge security-only --no-edit && git push origin main
      ```
- [ ] Netlify auto-builds `main`. Confirm the deploy goes green
      (`netlify api listSiteDeploys` or the dashboard).

## Step 7 — Production smoke test
On `https://vectorfootball.co.uk`:
- [ ] Sign up → confirm email → onboarding → generate programme → trial unlocks access.
- [ ] Log in/out, shared-device isolation (second account doesn't see the first's data).
- [ ] Sentry receiving events; PostHog funnel firing.
- [ ] Re-run the email-confirmation **resend** flow (the known P0 bug — verify it's fixed before launch).

## Step 8 — Rollback plan
If production breaks after Step 6:
```
git revert -m 1 <merge-commit-sha> && git push origin main   # reverts the cutover on web
```
Edge functions: redeploy the previous version from the `main` pre-cutover commit.
Entitlement *reads* fail safe (the client treats RPC errors as "no change"), so a
web rollback is low-risk; the trial-only launch window is the safety net.

---

## iOS App Store track (parallel — the "(now on iOS)" bracket)
- [ ] Confirm the fixed build is archived + uploaded; demo creds + notes in App Review Information.
- [ ] **Submit for review now** (max buffer — Apple takes 1–3 days, can reject).
- [ ] If approved by ~18th: swap the "App Store — coming soon" placeholder in
      `landing.html` + `waitlist/index.html` (HTML comments mark the exact spot) and
      test the live IAP once.
- [ ] If not approved: launch web only; placeholder stays. Announce iOS when it clears.

## Announcement (Fri 19)
- [ ] Waitlist email (Mailchimp) scheduled; social posts queued (IG, X, TikTok @vector.football4).
- [ ] PostHog snippet live on landing + waitlist (measure launch conversion).
- [ ] Screenshots / demo in the landing + waitlist hero.
