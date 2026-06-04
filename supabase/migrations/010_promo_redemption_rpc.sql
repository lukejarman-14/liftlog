-- ============================================================================
-- 010 — Promo redemption moved fully server-side
-- ============================================================================
-- Closes the promo-code brute-force hole:
--   - The client used to SELECT promo_codes directly, so codes were
--     enumerable and the only rate limit was client-side (bypassable).
--   - Redemption is now a single SECURITY DEFINER RPC that validates,
--     rate-limits (server-side), requires a confirmed email, and records
--     the redemption atomically.
--   - Direct client SELECT on promo_codes is removed entirely.
--
-- Depends on:
--   - public.is_email_confirmed()        (migration 009)
--   - public.check_edge_rate_limit(...)  (migration 005)
--   - public.promo_redemptions           (migration 20260527), unique(code,user_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_code    text := upper(trim(coalesce(p_code, '')));
  v_active  boolean;
  v_allowed boolean;
  c_duration_ms constant bigint := 30::bigint * 24 * 60 * 60 * 1000; -- 30 days
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Length guard before any work — codes are short alphanumerics.
  IF length(v_code) = 0 OR length(v_code) > 32 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- Require a confirmed email — kills throwaway-account farming.
  IF NOT public.is_email_confirmed() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'email_unconfirmed');
  END IF;

  -- Server-side rate limit: 10 attempts / hour / user (reuses migration 005).
  v_allowed := public.check_edge_rate_limit(v_user, 'redeem_promo_code', 10, 60);
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  -- Validate the code using the function's definer rights — the client has
  -- no direct SELECT on promo_codes, so codes cannot be enumerated.
  SELECT active INTO v_active FROM public.promo_codes WHERE code = v_code;

  IF v_active IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;
  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'reason', 'inactive');
  END IF;

  -- Atomic single-use insert; unique(code,user_id) prevents re-redemption.
  BEGIN
    INSERT INTO public.promo_redemptions (code, user_id) VALUES (v_code, v_user);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_used');
  END;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', (floor(extract(epoch FROM now()) * 1000) + c_duration_ms)::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- Lock down promo_codes: remove every client-facing policy so the table cannot
-- be read or enumerated directly. RLS stays ON; the definer RPC above is the
-- only path that can read it. The DO-block drops policies regardless of name
-- (some were created by hand and their names are unknown).
-- ----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'promo_codes'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.promo_codes', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Direct read is now blocked (run as an authenticated client, not service role):
--    SELECT * FROM public.promo_codes;            -- expect: 0 rows (no SELECT policy)
-- 2. Redemption works end-to-end:
--    SELECT public.redeem_promo_code('VECTORVIP'); -- expect: {"success":true,...}
-- 3. Re-redemption blocked:
--    SELECT public.redeem_promo_code('VECTORVIP'); -- expect: {"reason":"already_used"}

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.redeem_promo_code(text);
-- CREATE POLICY "promo_codes_select_active" ON public.promo_codes
--   FOR SELECT TO authenticated USING (active = true);
-- ============================================================================
