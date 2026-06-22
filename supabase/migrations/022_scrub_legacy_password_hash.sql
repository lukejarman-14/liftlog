-- ============================================================================
-- 022 — Scrub legacy password hashes from cloud user_data
-- ============================================================================
-- Security review finding: older app versions uploaded the local password gate
-- hash (single-round SHA-256 of email+password) inside the vf_user_profile blob.
-- Current clients strip it on upload (cloudSaveData) and no longer generate it
-- for new accounts, but rows written before that fix may still carry the hash.
--
-- A fast, un-stretched hash of a password the user very likely reuses for their
-- Supabase login must not sit at rest in user_data. RLS already limits each row
-- to its owner, so this is not cross-user readable — but we remove it entirely
-- as defence-in-depth (breach / export hardening).
--
-- Idempotent: only touches rows that still contain the key. Safe to re-run.
-- ============================================================================

UPDATE public.user_data
SET app_data = jsonb_set(
      app_data,
      '{vf_user_profile}',
      (app_data -> 'vf_user_profile') - 'passwordHash'
    ),
    updated_at = now()
WHERE app_data ? 'vf_user_profile'
  AND jsonb_typeof(app_data -> 'vf_user_profile') = 'object'
  AND (app_data -> 'vf_user_profile') ? 'passwordHash';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Expect 0 rows after running:
--   SELECT count(*) FROM public.user_data
--   WHERE (app_data -> 'vf_user_profile') ? 'passwordHash';
-- ============================================================================
