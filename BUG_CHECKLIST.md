# Vector Football Open Bug Checklist

Last pruned: 2026-06-05

Scope:

- `Vector Football V2`
- `Vector Football V2 Backup`
- `vectorfootball-waitlist`
- `Vector Football App Store`
- V1 intentionally excluded

This file now keeps only unresolved or partially fixed bugs. Items confirmed
fixed during the 2026-06-05 audit were removed.

## P0 - Release Blockers

- [ ] Decide and implement one truthful trial policy.
  - Problem: historical launch notes, UI copy, comments, Stripe trials, referral
    grants, and local trial code still disagree between 14 days, 21 days,
    30 days, and "until August 1".
  - Fix: choose the product policy once, implement it server-side, and update all
    app, Stripe, RevenueCat, terms, paywall, referral, promo, and launch copy.
  - Verify: expiry is controlled by server/test-clock state, not by changing only
    device time or localStorage.

- [ ] Wire web trials to the server `start_trial()` RPC.
  - Problem: the web paywall still calls `premium.startTrial()`, which writes a
    local `vf_premium` trial clock. Migration `015` adds server-owned
    `start_trial()` and `get_my_entitlement()`, but the client does not use
    `start_trial()` yet.
  - Evidence: `src/App.tsx:1597`, `src/hooks/usePremium.ts:59-63`,
    `supabase/migrations/015_server_authoritative_entitlements.sql:160-178`.
  - Fix: call `start_trial()` for authenticated web trials, refresh from
    `get_my_entitlement()`, and require server entitlement checks for every paid
    backend workflow.
  - Verify: clearing or editing `vf_premium` cannot restart a trial, extend
    access, or unlock paid server behavior.

- [ ] Make account role, coach/club access, and checkout product selection
  server-authoritative.
  - Problem: `accountType` remains client-local in key flows. Checkout accepts a
    client-supplied `accountType` if it is one of the allowed strings, and
    `register_squad()` only distinguishes paid versus unpaid, not Coach versus
    Club. Club still cannot truly receive the promised 200-seat server tier.
  - Evidence: `src/lib/stripeCheckout.ts`, `supabase/functions/create-checkout-session/index.ts`,
    `supabase/migrations/015_server_authoritative_entitlements.sql`,
    `supabase/migrations/018_tier_aware_seat_cap.sql`.
  - Fix: store role/product/tier server-side, map allowed Stripe/RevenueCat
    products from that server record, and enforce role/tier in every coach/club
    table, RPC, and Edge Function.
  - Verify: a player cannot create coach/club records or request coach/club
    products by editing localStorage or invoking APIs directly.

- [ ] Complete the repeat Stripe trial and duplicate-subscription guard.
  - Problem: the checkout guard checks `entitlements.trial_started_at`, but
    Stripe checkout/webhook does not stamp that field when a Stripe trial is
    created. A cancelled/revoked trial can therefore leave `trial_started_at`
    null and allow another trial.
  - Evidence: `supabase/functions/create-checkout-session/index.ts:158-211`,
    `supabase/functions/stripe-webhook/index.ts`.
  - Fix: stamp a server-owned trial-used fact when any Stripe trial is created,
    query active subscriptions before checkout, and use idempotency keys.
  - Verify: repeat and concurrent checkout attempts cannot create a second trial
    or duplicate active subscription.

- [ ] Require an exact RevenueCat product allowlist before granting entitlement.
  - Problem: `planForProduct()` can return `null`, but the RevenueCat webhook
    still upserts `is_premium=true`. With an unrecognized product and no
    expiration, `get_my_entitlement()` can treat the user as paid.
  - Evidence: `supabase/functions/revenuecat-webhook/index.ts:27-34`,
    `supabase/functions/revenuecat-webhook/index.ts:82-93`,
    `supabase/migrations/015_server_authoritative_entitlements.sql:113-118`.
  - Fix: use an exact product-id allowlist, skip or reject unknown products,
    require `plan IS NOT NULL` for paid grants, and test unknown product IDs.

- [ ] Move referral redemption and rewards into one atomic server-side flow.
  - Problem: referral redemption still performs client-side owner lookup,
    client-side existence checks, direct `referrals` INSERT, and direct
    `reward_applied` UPDATE. Rewards are then applied to local `vf_premium`
    rather than to server-owned entitlement rows.
  - Evidence: `src/lib/referrals.ts:48-98`, `src/hooks/usePremium.ts:207-255`,
    `supabase/migrations/002_core_tables_rls_policies.sql:101-115`.
  - Fix: redeem and claim through locked SECURITY DEFINER RPCs that validate code
    ownership, uniqueness, caps, reward state, and grant expiry in `entitlements`.
  - Verify: replay, forged relationships, direct REST calls, and concurrent
    claims cannot grant extra rewards.

- [ ] Make promo and referral grants portable and server-authoritative.
  - Problem: promo/referral redemption is recorded in the database, but access is
    still written to local `vf_premium`. A new device can lose access while the
    database prevents the code from being redeemed again.
  - Evidence: `src/hooks/usePremium.ts:207-299`,
    `supabase/migrations/015_server_authoritative_entitlements.sql:29-30`.
  - Fix: write `grant_expires_at` through server-side promo/referral RPCs and
    return the grant through `get_my_entitlement()`.

- [ ] Replace deterministic squad invite codes with high-entropy server tokens.
  - Problem: squad invite codes are still a deterministic 5-character code
    derived from the user ID. Referral-code enumeration is now reduced, but the
    squad code itself remains short and non-rotatable.
  - Evidence: `src/lib/teams.ts:7-15`.
  - Fix: generate random, high-entropy, rotatable, expiring invite tokens
    server-side and expose only a rate-limited redemption RPC.

- [ ] Authoritatively revoke squad-derived Premium.
  - Problem: joining a Pro squad still writes local `vf_premium`, and
    `syncEntitlementFromServer()` is upgrade-only. Removal from a squad, coach
    cancellation, tier downgrade, or webhook delay can leave stale local access.
  - Evidence: `src/App.tsx:637-647`, `src/hooks/usePremium.ts:133-164`.
  - Fix: never grant squad access by local write; always compute/revoke it from
    `get_my_entitlement()` and clear stale local state when the server says no.

- [ ] Make Stripe and RevenueCat webhook state ordered and subscription-aware.
  - Problem: webhooks have idempotency ledgers now, but entitlement is still
    mutated from individual events without an event-order guard or a full
    "derive from current provider state" check. Deleting one subscription can
    still revoke access while another is active.
  - Evidence: `supabase/functions/stripe-webhook/index.ts`,
    `supabase/functions/revenuecat-webhook/index.ts`.
  - Fix: record event IDs/timestamps, derive entitlement from current provider
    subscription state, handle multiple active subscriptions, and test
    out-of-order events, refunds, failed payments, and lifetime purchases.

- [ ] Rebuild Supabase migrations so a blank project can deploy cleanly.
  - Problem: base app tables are still not created in the repo migrations.
    Numbered migrations refer to tables that are only created by later timestamp
    files, and migration `008` references the wrong schema.
  - Evidence: no `CREATE TABLE` migration for several app tables; `010` and
    `012` depend on `promo_redemptions` before `20260527_promo_redemptions.sql`;
    `008_input_length_constraints.sql` references `coach_player_notes`,
    `first_name`, and `last_name`.
  - Fix: create a clean baseline, include every table/function/policy, use one
    sortable migration naming scheme, and prove `supabase db reset` passes.

- [ ] Do not reuse the old App Store archive.
  - Problem: uploaded build 3 from 2026-05-24 predates the security fixes and
    the current HealthKit work.
  - Fix: rebuild from the reviewed commit, sync current web assets into iOS,
    increment the build number, archive, and upload a replacement.

- [ ] Prove production is deployed from the reviewed hardened commit.
  - Problem: local fixes do not prove Netlify, Supabase functions/migrations,
    Stripe/RevenueCat webhooks, or App Store builds are live.
  - Fix: record the exact deployed Git commit, Supabase migration/function
    versions, Netlify deploy, and App Store build number.

## P1 - Security And Privacy Bugs

- [ ] Harden billing functions beyond the current partial checks.
  - Problem: checkout and portal now reject non-POST requests, and the current
    portal diff returns generic Stripe errors. Remaining gaps: body-size checks
    rely on `Content-Length`, chunked bodies can still be parsed before a hard
    cap, and checkout still returns raw Stripe/Supabase error text in some paths.
  - Evidence: `supabase/functions/create-checkout-session/index.ts`,
    `supabase/functions/create-portal-session/index.ts`.
  - Fix: require POST everywhere, cap streamed body reads, validate schemas, and
    return generic client errors while logging details server-side.

- [ ] Finish atomic enforcement for auth/referral limits and caps.
  - Problem: migration `019` serializes edge rate limits and squad seat caps, but
    auth attempts and referral cap logic still use count-then-insert/update style
    checks.
  - Evidence: `supabase/migrations/006_auth_rate_limiting.sql`,
    `supabase/migrations/009_referrals_hardening.sql`,
    `supabase/migrations/019_atomic_caps.sql`.
  - Fix: use fixed server parameters, advisory locks or row locks, cleanup jobs,
    and abuse tests for concurrent auth/referral attempts.

- [ ] Add database quotas and correct server-side field constraints.
  - Problem: authenticated callers can bypass UI limits and write large
    `user_data` blobs, profiles, schedules, formations, match squads, and notes.
    The current constraint migration references missing/wrong tables/columns.
  - Evidence: `supabase/migrations/008_input_length_constraints.sql`.
  - Fix: add correct length/range/JSON-size constraints, per-owner quotas, and
    narrow RPCs for sensitive writes.

- [ ] Fix coach-note data ownership and saving.
  - Problem: notes are still stored in one shared `player_profiles.coach_notes`
    value, so multiple coaches can overwrite each other. The player-detail
    autosave effect still cannot reliably fire when closing because `selected`
    becomes null with `selectedId`.
  - Evidence: `src/components/screens/CoachDashboard.tsx:342-346`,
    `src/App.tsx:818-831`, `supabase/migrations/004_coach_notes_column.sql`.
  - Fix: store notes by `(coach_id, player_id)` in a dedicated table/RPC and
    save on explicit close/blur with tested error handling.

- [ ] Make cloud save failures visible and prevent last-write-wins data loss.
  - Problem: `cloudSaveData()` still logs errors only in development and does
    not throw. Multiple tabs/devices still replace the whole JSON blob without
    versioning or conflict handling.
  - Evidence: `src/lib/cloudSync.ts:185-215`.
  - Fix: return checked errors, show retry/failure UI, add versions/conflict
    resolution, and move high-value data out of a single blob.

- [ ] Make account deletion fully fail-closed and auditable.
  - Problem: the UI no longer wipes local data when deletion fails, but
    `cloudDeleteAccount()` still signs out in `finally`, even after a failed
    server deletion. Cascades for all related coach/referral/billing data are
    still not proven by local migrations.
  - Evidence: `src/lib/cloudSync.ts:122-139`, `src/App.tsx:1475-1487`.
  - Fix: do not sign out on failed deletion unless recovery is explicit; delete
    through a reviewed transaction and test every related table.

- [ ] Require recent reauthentication for profile password changes.
  - Problem: password length validation is now consistent, but Supabase profile
    password changes can still proceed from an active session without verifying
    the current password when no local `passwordHash` exists.
  - Evidence: `src/components/screens/Profile.tsx:528-548`,
    `src/lib/cloudSync.ts:171-174`.
  - Fix: require current password, recent reauth, or MFA before changing a
    logged-in user's password.

- [ ] Correct privacy/security claims and App Store privacy declarations.
  - Problem: PostHog is now consent-first, but Sentry disclosure/scrubbing and
    App Store privacy declarations still need a legal/product review. The iOS
    privacy manifest currently declares only Email and Fitness/Exercise data,
    while the app handles names, IDs, body metrics/DOB, purchases, product
    interaction, diagnostics, and derived HealthKit readiness values.
  - Evidence: `src/lib/sentry.ts`, `ios/App/App/PrivacyInfo.xcprivacy`.
  - Fix: disclose every processor and data category, scrub Sentry extras and
    breadcrumbs, and align app copy with actual collection/sync behavior.

- [ ] Handle HealthKit query errors explicitly.
  - Problem: HRV/resting-heart-rate queries are now limited to the last seven
    days, but query errors are still ignored.
  - Evidence: `ios/App/App/HealthKitPlugin.swift:94-128`.
  - Fix: surface/log HealthKit query errors and test no-permission, no-data,
    stale-data, and partial-error cases.

- [ ] Review native WebView navigation and local CSP behavior.
  - Problem: Netlify now sets HSTS/CSP for web, but bundled native pages do not
    receive those headers. Native navigation allowlists and WebView security
    behavior still need verification.
  - Fix: define native navigation restrictions, local CSP expectations, and test
    auth, payment, Sentry, PostHog, hCaptcha, and external-link behavior in iOS.

- [ ] Remove remaining production preview/test toggles.
  - Problem: production coach demo players are now gated behind
    `import.meta.env.DEV`, but `vf_health_preview` can still reveal Health
    preview UI via localStorage.
  - Evidence: `src/components/DailyReadinessWidget.tsx:183-186`.
  - Fix: compile preview toggles only into explicit development builds.

## P2 - Reliability, Delivery, And Cleanup

- [ ] Move GitHub Actions to `.github/workflows/ci.yml` and expand CI.
  - Problem: the workflow is still nested at
    `.github/workflows/.github/workflows/ci.yml`, so GitHub Actions will not
    discover it.
  - Fix: move it, then add tests, dependency audit, secret scan, web build,
    migration reset, Edge/RLS tests, and iOS Release build.

- [ ] Add backend, RLS, Edge Function, and billing security tests.
  - Cover direct REST attacks, role/tier bypasses, entitlement spoofing,
    membership insertion, referral/promo abuse, webhook ordering/idempotency,
    rate-limit concurrency, and clean migration deployment.

- [ ] Add user-visible failure and recovery behavior for coach saves.
  - Problem: several coach writes still log errors or return silently instead of
    showing actionable retry/failure UI.
  - Evidence: schedule/profile/attendance/match-result paths in `src/App.tsx`.
  - Fix: preserve unsaved changes, show toast/modal errors, retry safely, and
    test offline/network-failure behavior.

- [ ] Audit `handleSaveMatchResult` dependencies and duplicate handling.
  - Problem: `handleSaveMatchResult` still checks `matchResults` from React
    state before inserting. This is a client-side duplicate guard and can race
    across tabs/devices.
  - Evidence: `src/App.tsx:955-963`.
  - Fix: enforce uniqueness in the database and handle conflicts cleanly.

- [ ] Repair or quarantine `Vector Football V2 Backup`.
  - Problem: backup dependencies were broken during audit, the backup lacks the
    current migration/security state, and it should not be deployable by mistake.
  - Fix: mark it non-deployable or archive it outside release workflows.

- [ ] Harden standalone `vectorfootball-waitlist`.
  - Problem: the standalone waitlist still uses Mailchimp JSONP, exposes email
    in third-party query URLs, has new-tab links without `rel`, and keeps a
    distributable zip containing `.git` history.
  - Evidence: `/Users/lukejarman/Desktop/vectorfootball-waitlist/script.js`,
    `/Users/lukejarman/Desktop/vectorfootball-waitlist/index.html`,
    `/Users/lukejarman/Desktop/vectorfootball-waitlist/vectorfootball-waitlist.zip`.
  - Fix: use a small server-side signup endpoint, add headers/CSP/rate limiting,
    add `rel="noopener noreferrer"`, and rebuild archives from an allowlist.

- [ ] Force fresh web assets into every iOS release.
  - Fix: release automation should run install, tests, build, `npx cap sync ios`,
    verify commit/asset hashes, then archive.

- [ ] Review legal/analytics/HealthKit/waitlist copy against implementation.
  - Fix: ensure privacy, cookie, terms, App Store labels, Sentry/PostHog
    disclosure, Mailchimp behavior, HealthKit wording, and deletion promises
    match the live implementation.

## Release Acceptance Still Required

- [ ] Pass static checks and automated builds from a clean install.
  - Include TypeScript, unit tests, dependency audit, web build, clean Supabase
    reset, backend/RLS/Edge tests, and iOS Release build.

- [ ] Pass Personal, Coach, and Club account acceptance tests.
  - Verify onboarding, role authorization, paywall/products, trial/expiry,
    purchase/restore/cancel, deletion, and all feature access boundaries.

- [ ] Pass coach-feature persistence and offline tests.
  - Verify formations, benches, attendance, attendance edits, announcements,
    match results, schedules, match squads, and coach notes across network loss,
    app close, restart, retry, and multi-device edits.

- [ ] Pass squad isolation and performance tests.
  - Test at least three simultaneous coach accounts and documented max squad/club
    sizes with measurable latency/error targets.

- [ ] Pass referral, promo, squad-invite, and billing abuse tests.
  - Verify forged codes, replay, concurrent claims, UUID/code guessing, direct
    REST/RPC calls, success-URL spoofing, customer-ID substitution, duplicate
    checkout, repeated trials, webhook replay, refunds, cancellations, failed
    payments, and restores.

- [ ] Deploy only the reviewed commit and monitor launch.
  - Verify production URL, commit/asset hashes, Supabase migrations/functions,
    auth/email, billing, RLS, Sentry, consent-gated analytics, rollback
    procedure, and first-24-hour monitoring.

## Latest Local Verification Snapshot

- 2026-06-05 before pruning: V2 tests passed, V2 production build passed,
  dependency audit reported 0 vulnerabilities, secret-pattern scan found no
  committed secret values, web headers/service worker were rechecked, and iOS
  plist/privacy/entitlements linted OK.
- Live Supabase, Stripe, RevenueCat, Netlify, and App Store settings still need
  environment-level verification.
