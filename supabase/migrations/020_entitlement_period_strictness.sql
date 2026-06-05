-- ============================================================================
-- 020 — Entitlement strictness: a paid grant needs a known plan + valid period
-- ============================================================================
-- Codex re-review (real bug in 015): both has_paid_entitlement() and
-- get_my_entitlement() treated current_period_end IS NULL as "valid forever".
-- Combined with the RevenueCat webhook upserting is_premium=true even when the
-- product is unrecognized (plan = NULL, no expiry), an UNKNOWN product could be
-- treated as permanent premium.
--
-- Fix: a paid grant now requires plan IS NOT NULL, and for non-lifetime plans an
-- actual, unexpired current_period_end. Only 'lifetime' may have a null period.
-- (The RC webhook is also fixed to refuse unknown products — defense in depth.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_paid_entitlement(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = p_uid
      AND e.is_premium = true
      AND e.source IN ('stripe','revenuecat')
      AND e.plan IS NOT NULL
      AND (e.plan = 'lifetime'
           OR (e.current_period_end IS NOT NULL AND e.current_period_end > now()))
  );
$$;
REVOKE ALL ON FUNCTION public.has_paid_entitlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_paid_entitlement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  e      public.entitlements%ROWTYPE;
  v_trial_end timestamptz;
  v_squad_pro boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'is_premium', false);
  END IF;

  SELECT * INTO e FROM public.entitlements WHERE user_id = v_user;

  -- 1. Genuine paid access: known plan + (lifetime OR unexpired period).
  IF e.is_premium AND e.source IN ('stripe','revenuecat') AND e.plan IS NOT NULL
     AND (e.plan = 'lifetime'
          OR (e.current_period_end IS NOT NULL AND e.current_period_end > now())) THEN
    RETURN jsonb_build_object(
      'has_access', true, 'is_premium', true, 'plan', e.plan,
      'source', e.source,
      'expires_at', (extract(epoch FROM e.current_period_end) * 1000)::bigint);
  END IF;

  -- 2. Active promo/referral timed grant.
  IF e.grant_expires_at IS NOT NULL AND e.grant_expires_at > now() THEN
    RETURN jsonb_build_object(
      'has_access', true, 'is_premium', false, 'source', 'grant',
      'expires_at', (extract(epoch FROM e.grant_expires_at) * 1000)::bigint);
  END IF;

  -- 3. Squad-inherited access — member of a Pro squad whose coach genuinely pays.
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members sm
    JOIN public.coach_squads cs ON cs.coach_id = sm.coach_id
    WHERE sm.player_id = v_user
      AND cs.tier IN ('pro','club')
      AND public.has_paid_entitlement(sm.coach_id)
  ) INTO v_squad_pro;
  IF v_squad_pro THEN
    RETURN jsonb_build_object('has_access', true, 'is_premium', false, 'source', 'squad');
  END IF;

  -- 4. Active 30-day trial.
  IF e.trial_started_at IS NOT NULL THEN
    v_trial_end := e.trial_started_at + interval '30 days';
    IF v_trial_end > now() THEN
      RETURN jsonb_build_object(
        'has_access', true, 'is_premium', false, 'source', 'trial',
        'expires_at', (extract(epoch FROM v_trial_end) * 1000)::bigint);
    END IF;
  END IF;

  RETURN jsonb_build_object('has_access', false, 'is_premium', false);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_entitlement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Row with is_premium=true, plan=NULL, period=NULL → get_my_entitlement()
--    returns has_access=false (was true before this migration).
-- 2. Active monthly sub with future current_period_end → has_access=true.
-- 3. Expired sub (period in the past) → has_access=false.
-- ============================================================================
