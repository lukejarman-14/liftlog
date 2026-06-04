-- ============================================================================
-- 012 — Close the promo_redemptions direct-insert bypass
-- ============================================================================
-- Adversarial-review finding #1:
--   Migration 010 routed promo redemption through the redeem_promo_code RPC
--   (rate-limited + email-confirmed + atomic) and removed direct SELECT on
--   promo_codes. BUT the original direct-INSERT policy on promo_redemptions
--   (from migration 20260527) was still present, so a scripted client could
--   INSERT redemption rows directly and skip the RPC's checks.
--
--   The client no longer touches this table directly (verified: no .from
--   ('promo_redemptions') calls remain in src/). The redeem_promo_code RPC is
--   SECURITY DEFINER, so it keeps writing after this policy is dropped.
--
-- We keep the SELECT policy so the user can still read their own redemption
-- history if a future feature needs it; only the INSERT path is removed.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own redemptions" ON public.promo_redemptions;

-- RLS stays ON. With no INSERT policy, the ONLY way to record a redemption is
-- via the SECURITY DEFINER redeem_promo_code() RPC.
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. No INSERT policy remains (expect 0 rows named *insert*):
--    SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='promo_redemptions';
-- 2. Direct insert is now blocked for clients (run as authenticated, not service):
--    INSERT INTO public.promo_redemptions (code, user_id) VALUES ('X', auth.uid());
--    -- expect: new row violates row-level security policy
-- 3. RPC redemption still works:
--    SELECT public.redeem_promo_code('<an-active-code>');  -- expect success

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- CREATE POLICY "Users can insert their own redemptions"
--   ON public.promo_redemptions FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
-- ============================================================================
