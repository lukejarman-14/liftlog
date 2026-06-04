-- ============================================================================
-- 015 — Server-authoritative entitlements (foundation)
-- ============================================================================
-- Codex P0 root cause: premium status, squad tier, and the Stripe customer id all
-- lived in client-writable storage, so a user could fake premium (and then publish
-- a Pro squad that grants OTHERS premium), and could open another customer's
-- billing portal (IDOR).
--
-- This migration creates the authoritative server-side model. It is ADDITIVE —
-- it does not change existing client behaviour on its own; the webhook, portal,
-- and client are switched to it in companion changes.
--
-- Design (per product decision): RevenueCat owns iOS, Stripe owns web, both write
-- ONE entitlement record per user. Trial = 30 days per user, server-enforced.
--
-- Tables are written ONLY by the service role (webhooks) or SECURITY DEFINER
-- functions. Clients get read-only access to their OWN entitlement via an RPC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. entitlements — the single source of truth for paid access.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium         boolean NOT NULL DEFAULT false,          -- paid + active
  plan               text,                                    -- monthly|yearly|lifetime
  source             text,                                    -- stripe|revenuecat|null
  current_period_end timestamptz,                             -- subscription expiry (null for lifetime)
  trial_started_at   timestamptz,                             -- server-stamped on first trial
  grant_expires_at   timestamptz,                             -- promo/referral timed grant
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_plan CHECK (plan IS NULL OR plan IN ('monthly','yearly','lifetime'))
);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- Read-only access to your OWN row. No client INSERT/UPDATE/DELETE policies at
-- all → only the service role (webhooks) and SECURITY DEFINER fns can write.
DROP POLICY IF EXISTS "entitlements_select_own" ON public.entitlements;
CREATE POLICY "entitlements_select_own"
  ON public.entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. stripe_customers — server-only mapping (fixes the billing-portal IDOR).
--    No client policies → unreadable/unwritable by clients; service role only.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
-- (Intentionally no policies — only the service-role key bypasses RLS.)

-- ----------------------------------------------------------------------------
-- 3. billing_events — idempotency ledger so webhook retries are safe.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  event_id     text PRIMARY KEY,           -- Stripe/RevenueCat event id
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
-- (No policies — service-role only.)

-- ----------------------------------------------------------------------------
-- 4. has_paid_entitlement(uid) — true if the user currently has a genuine PAID
--    subscription/lifetime (NOT trial, promo, referral, or squad-inherited).
--    Used to decide squad tier so inherited premium can only come from a real payer.
-- ----------------------------------------------------------------------------
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
      AND (e.plan = 'lifetime' OR e.current_period_end IS NULL OR e.current_period_end > now())
  );
$$;
REVOKE ALL ON FUNCTION public.has_paid_entitlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_paid_entitlement(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. get_my_entitlement() — the single read the client trusts. Combines paid,
--    trial (30d), promo/referral grant, and squad-inherited access for auth.uid().
-- ----------------------------------------------------------------------------
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

  -- 1. Genuine paid access (own subscription / lifetime).
  IF e.is_premium AND e.source IN ('stripe','revenuecat')
     AND (e.plan = 'lifetime' OR e.current_period_end IS NULL OR e.current_period_end > now()) THEN
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
      AND cs.tier = 'pro'
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

-- ----------------------------------------------------------------------------
-- 6. start_trial() — server-stamps the 30-day trial once (idempotent). The client
--    can no longer fabricate trial length; the server owns trial_started_at.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  INSERT INTO public.entitlements (user_id, trial_started_at)
  VALUES (v_user, now())
  ON CONFLICT (user_id) DO UPDATE
    SET trial_started_at = COALESCE(public.entitlements.trial_started_at, now()),
        updated_at = now();
  RETURN public.get_my_entitlement();
END;
$$;
REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. register_squad(p_team_code) — coach/club registers their squad. Tier is set
--    SERVER-SIDE from the coach's genuine paid entitlement, NEVER from the client.
--    This is what breaks the "spoof local premium → publish Pro squad" chain.
--    Removes the need for any client write to coach_squads.tier.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_squad(p_team_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tier text;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  -- Tier is derived from real payment state only.
  v_tier := CASE WHEN public.has_paid_entitlement(v_user) THEN 'pro' ELSE 'free' END;

  INSERT INTO public.coach_squads (coach_id, team_code, tier, updated_at)
  VALUES (v_user, upper(trim(p_team_code)), v_tier, now())
  ON CONFLICT (coach_id) DO UPDATE
    SET team_code = excluded.team_code,
        tier      = excluded.tier,     -- always server-recomputed
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'tier', v_tier);
END;
$$;
REVOKE ALL ON FUNCTION public.register_squad(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_squad(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. Remove client write access to coach_squads.tier. Coaches may still create
--    their squad row, but tier is forced server-side. We replace the broad
--    INSERT/UPDATE policies with ones that only allow the FREE tier from the
--    client; the register_squad RPC (definer) is the only path to 'pro'.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "coach_squads_insert_own" ON public.coach_squads;
DROP POLICY IF EXISTS "coach_squads_update_own" ON public.coach_squads;
CREATE POLICY "coach_squads_insert_own"
  ON public.coach_squads FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid() AND tier = 'free');
CREATE POLICY "coach_squads_update_own"
  ON public.coach_squads FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() AND tier = 'free');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. SELECT public.get_my_entitlement();            -- {"has_access":false,...} for a fresh user
-- 2. A coach cannot set tier='pro' directly:
--    UPDATE public.coach_squads SET tier='pro' WHERE coach_id = auth.uid();  -- RLS denies
-- 3. SELECT public.register_squad('VF-XXXXX');       -- tier reflects real payment only
-- 4. Tables unwritable by clients:
--    INSERT INTO public.entitlements (user_id,is_premium) VALUES (auth.uid(),true); -- RLS denies

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.register_squad(text), public.start_trial(),
--   public.get_my_entitlement(), public.has_paid_entitlement(uuid);
-- DROP TABLE IF EXISTS public.billing_events, public.stripe_customers, public.entitlements;
-- (and restore the original coach_squads insert/update policies from migration 001)
-- ============================================================================
