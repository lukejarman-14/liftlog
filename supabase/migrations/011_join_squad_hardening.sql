-- ============================================================================
-- 011 — join_squad hardening + squad seat cap
-- ============================================================================
-- Closes the team-code enumeration hole:
--   - Team codes are short (VF-XXXXX ≈ 33.5M space) and joining a Pro squad
--     grants inherited premium, so enumeration was worth scripting.
--   - join_squad had no server-side rate limit and was NOT in version control.
--   - The 30-player seat cap was only enforced in the UI.
--
-- This migration:
--   1. Puts join_squad under version control with a pinned search_path,
--      email-confirmed gate, self-join guard, and per-user rate limiting.
--   2. Adds a table-level seat-cap trigger so the 30-player limit holds on
--      EVERY insert path, not just the RPC.
--
-- ⚠️  VERIFY BEFORE PRODUCTION: the original join_squad was created by hand and
--     is not in any migration. This version matches the call contract used by
--     src/lib/teams.ts — rpc('join_squad', { p_code }) returning (coach_id, tier),
--     erroring with 'invalid_code' / 'self_join'. Confirm squad_members has
--     columns (coach_id uuid, player_id uuid) with any other columns defaulted,
--     then test the join flow on a staging/branch DB before running on prod.
--
-- Depends on:
--   - public.is_email_confirmed()        (migration 009)
--   - public.check_edge_rate_limit(...)  (migration 005)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Seat cap as a BEFORE INSERT trigger — defends every insert path.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_squad_seat_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
  c_cap   constant int := 30;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.squad_members
  WHERE coach_id = NEW.coach_id;

  IF v_count >= c_cap THEN
    RAISE EXCEPTION 'squad_full';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_squad_seat_cap ON public.squad_members;
CREATE TRIGGER trg_squad_seat_cap
  BEFORE INSERT ON public.squad_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_squad_seat_cap();

-- ----------------------------------------------------------------------------
-- 2. Prevent a player being added to the same squad twice (idempotent joins).
--    NOTE: if duplicate (coach_id, player_id) rows already exist this errors —
--    de-dupe first:
--      SELECT coach_id, player_id, count(*) FROM public.squad_members
--      GROUP BY 1,2 HAVING count(*) > 1;
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_member
  ON public.squad_members (coach_id, player_id);

-- ----------------------------------------------------------------------------
-- 3. Hardened join_squad.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_squad(p_code text)
RETURNS TABLE (coach_id uuid, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player uuid := auth.uid();
  v_coach  uuid;
  v_tier   text;
BEGIN
  IF v_player IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Require a confirmed email before any lookup work.
  IF NOT public.is_email_confirmed() THEN
    RAISE EXCEPTION 'email_unconfirmed';
  END IF;

  -- Throttle enumeration: 20 attempts / hour / user (reuses migration 005).
  IF NOT public.check_edge_rate_limit(v_player, 'join_squad', 20, 60) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT cs.coach_id, cs.tier
    INTO v_coach, v_tier
  FROM public.coach_squads cs
  WHERE cs.team_code = upper(trim(coalesce(p_code, '')));

  IF v_coach IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  IF v_coach = v_player THEN
    RAISE EXCEPTION 'self_join';
  END IF;

  -- Insert membership; the seat-cap trigger + unique index guard the rest.
  INSERT INTO public.squad_members (coach_id, player_id)
  VALUES (v_coach, v_player)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_coach, v_tier;
END;
$$;

REVOKE ALL ON FUNCTION public.join_squad(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_squad(text) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Function present + secured:
--    SELECT proname, prosecdef FROM pg_proc WHERE proname = 'join_squad';  -- prosecdef = t
-- 2. Seat cap trigger present:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.squad_members'::regclass;
-- 3. Functional test (use a real player session + a real coach code):
--    SELECT * FROM public.join_squad('VF-XXXXX');

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_squad_seat_cap ON public.squad_members;
-- DROP FUNCTION IF EXISTS public.enforce_squad_seat_cap();
-- DROP INDEX IF EXISTS public.uq_squad_member;
-- -- Restore your previous join_squad definition here if you have it backed up.
-- ============================================================================
