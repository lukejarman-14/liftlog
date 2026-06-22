-- ============================================================================
-- 018 — Tier-aware squad seat cap
-- ============================================================================
-- Codex finding: enforce_squad_seat_cap() hardcoded 30 for EVERY squad. Two bugs:
--   1. Free squads (UI limit 5) could be grown to 30 via direct REST/RPC calls.
--   2. Club squads (UI promises 200) were silently capped at 30.
--
-- Fix: derive the cap from the squad's server-side tier in coach_squads:
--     free → 5,  pro → 30,  club → 200.
--
-- NOTE on club: coach_squads.tier is currently only ever set to 'free' or 'pro'
-- by register_squad() (migration 015), because the entitlement record does not
-- yet distinguish a Coach plan from a Club plan. So a Club account that pays
-- currently gets 'pro' (cap 30) — no regression vs the old hardcoded 30. To
-- actually unlock 200, the billing webhooks must record the PRODUCT (coach vs
-- club) on entitlements and register_squad must set tier='club'. That is part of
-- the "server-authoritative account role / checkout product authority" work and
-- the pending Stripe/RC product-config decision. The cap table below is already
-- ready for 'club' so only register_squad needs updating once that lands.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_squad_seat_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
  v_tier  text;
  v_cap   int;
BEGIN
  SELECT cs.tier INTO v_tier
  FROM public.coach_squads cs
  WHERE cs.coach_id = NEW.coach_id;

  v_cap := CASE v_tier
    WHEN 'club' THEN 200
    WHEN 'pro'  THEN 30
    ELSE 5            -- free / no squad row found
  END;

  SELECT count(*) INTO v_count
  FROM public.squad_members
  WHERE coach_id = NEW.coach_id;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'squad_full';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger definition unchanged (still BEFORE INSERT FOR EACH ROW) — recreating
-- the function via OR REPLACE is enough, but we re-assert the trigger for safety.
DROP TRIGGER IF EXISTS trg_squad_seat_cap ON public.squad_members;
CREATE TRIGGER trg_squad_seat_cap
  BEFORE INSERT ON public.squad_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_squad_seat_cap();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Free squad rejects the 6th member (direct INSERT or join_squad RPC).
-- 2. Pro squad allows up to 30.
-- 3. (Once club tier is wired) club squad allows up to 200.

-- ============================================================================
-- DOWN (rollback) — restore the flat 30 cap from migration 011.
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.enforce_squad_seat_cap() ... c_cap := 30 ...
-- ============================================================================
