-- ============================================================================
-- 019 — Atomic rate-limit + seat-cap enforcement (advisory locks)
-- ============================================================================
-- Codex finding: check_edge_rate_limit and the seat-cap trigger COUNT then INSERT.
-- Two concurrent requests can both pass the count before either inserts, so the
-- limit/cap is exceeded by the number of in-flight requests.
--
-- Fix: take a transaction-scoped advisory lock keyed to the contended resource
-- (user+endpoint, or coach's squad) at the top of each function. Concurrent calls
-- for the SAME key serialize, making the count-then-insert atomic. Different keys
-- don't contend, so throughput is unaffected.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Edge rate limit (checkout / portal / join_squad / promo) — per user+endpoint.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_edge_rate_limit(
  p_user_id        uuid,   -- IGNORED: kept for call-site signature compatibility
  p_endpoint       text,
  p_max_requests   int,
  p_window_minutes int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user       uuid := auth.uid();   -- authoritative identity, never the caller's param
  recent_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Serialize concurrent checks for this (user, endpoint) so the count+insert
  -- below is atomic — prevents two in-flight requests both passing the limit.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || ':' || p_endpoint)::bigint);

  SELECT COUNT(*) INTO recent_count
  FROM public.api_rate_limits
  WHERE user_id = v_user
    AND endpoint = p_endpoint
    AND requested_at > NOW() - (p_window_minutes || ' minutes')::interval;

  IF recent_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.api_rate_limits (user_id, endpoint, requested_at)
  VALUES (v_user, p_endpoint, NOW());

  DELETE FROM public.api_rate_limits
  WHERE user_id = v_user
    AND endpoint = p_endpoint
    AND requested_at < NOW() - ((p_window_minutes * 2) || ' minutes')::interval;

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.check_edge_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_edge_rate_limit(uuid, text, int, int) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Squad seat cap — per coach. Atomic so concurrent joins can't overfill.
--    (Tier-aware caps from migration 018 preserved.)
-- ----------------------------------------------------------------------------
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
  -- Serialize concurrent inserts for this coach's squad.
  PERFORM pg_advisory_xact_lock(hashtext('squad:' || NEW.coach_id::text)::bigint);

  SELECT cs.tier INTO v_tier
  FROM public.coach_squads cs
  WHERE cs.coach_id = NEW.coach_id;

  v_cap := CASE v_tier
    WHEN 'club' THEN 200
    WHEN 'pro'  THEN 30
    ELSE 5
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Fire N concurrent join_squad calls at a squad with 1 seat left → exactly one
-- succeeds. Fire N concurrent checkout calls at the limit boundary → no overflow.

-- ============================================================================
-- DOWN (rollback) — drop the PERFORM pg_advisory_xact_lock lines (restores 013/018).
-- ============================================================================
