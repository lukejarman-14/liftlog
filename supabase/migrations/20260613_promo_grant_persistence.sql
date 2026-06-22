-- ============================================================================
-- 20260613 — Promo grant persistence + permanent codes
-- ============================================================================
-- Two fixes:
--   1. redeem_promo_code now PERSISTS the grant into public.entitlements
--      (grant_expires_at). Previously it only returned an expiry to the client,
--      so get_my_entitlement() saw no grant on the next reload and the user was
--      bounced back to the paywall. Persisting it makes promo access survive
--      reloads on both web and native.
--   2. Per-code duration:
--        promo_codes.grant_days   integer  -- NULL => default 30 days
--        promo_codes.is_permanent boolean  -- true => never-expiring comp access
--
-- Depends on:
--   - migration 010 (redeem_promo_code, promo_codes, promo_redemptions)
--   - migration 015 (entitlements table + get_my_entitlement)
-- If those are not yet applied in production, apply them first — redeem will
-- error at call time with "relation public.entitlements does not exist".
-- ============================================================================

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS grant_days integer;            -- NULL => 30-day default

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_code       text := upper(trim(coalesce(p_code, '')));
  v_active     boolean;
  v_grant_days integer;
  v_permanent  boolean;
  v_allowed    boolean;
  v_expires    timestamptz;
  -- Finite far-future stand-in for "permanent" — avoids 'infinity' epoch casts
  -- that would break get_my_entitlement()'s expires_at extraction.
  c_forever constant timestamptz := timestamptz '2999-01-01 00:00:00+00';
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

  -- Validate the code using the function's definer rights — the client has no
  -- direct SELECT on promo_codes, so codes cannot be enumerated.
  SELECT active, grant_days, is_permanent
    INTO v_active, v_grant_days, v_permanent
    FROM public.promo_codes WHERE code = v_code;

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

  v_expires := CASE
    WHEN v_permanent THEN c_forever
    ELSE now() + (COALESCE(v_grant_days, 30) || ' days')::interval
  END;

  -- Persist the grant so access survives reloads. GREATEST() ensures a short
  -- code can never shorten an existing longer grant.
  INSERT INTO public.entitlements (user_id, grant_expires_at, updated_at)
  VALUES (v_user, v_expires, now())
  ON CONFLICT (user_id) DO UPDATE
    SET grant_expires_at = GREATEST(
          COALESCE(public.entitlements.grant_expires_at, v_expires), v_expires),
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', (floor(extract(epoch FROM v_expires) * 1000))::bigint
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Redeem a permanent code, then re-read entitlement (should show a grant):
--    SELECT public.redeem_promo_code('YOUR-CODE');   -- {"success":true,"expires_at":32472...}
--    SELECT public.get_my_entitlement();             -- {"has_access":true,"source":"grant",...}
-- 2. Reload the app — access persists (no paywall bounce).
--
-- The actual promo code rows are inserted OUT OF BAND (never committed here),
-- per the project's promo-code security policy. See chat / SECURITY_FIXES.md.
-- ============================================================================
