-- ============================================================================
-- 013 — Harden rate-limit SECURITY DEFINER functions
-- ============================================================================
-- Codex finding: check_edge_rate_limit accepted a caller-supplied p_user_id, so
-- any authenticated user could poison ANOTHER user's rate-limit bucket (DoS) by
-- passing the victim's UUID — e.g. exhaust their checkout/portal/join allowance.
-- The functions were also EXECUTE-able by PUBLIC and used search_path=public
-- (search-path-injection surface).
--
-- Fix: derive the user from auth.uid() INSIDE the function and ignore the
-- caller-supplied id (the parameter is retained only so existing .rpc() call
-- sites keep matching the signature). Pin search_path='', fully-qualify objects,
-- REVOKE from PUBLIC, GRANT to authenticated.
--
-- Backward-compatible: every caller (edge functions, redeem_promo_code,
-- join_squad) already passes the real user id == auth.uid(), so behaviour is
-- identical for legitimate calls — only spoofing is neutralised.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_edge_rate_limit(
  p_user_id        uuid,   -- IGNORED: kept only for call-site signature compatibility
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
  v_user       uuid := auth.uid();   -- authoritative identity; never the caller's param
  recent_count int;
BEGIN
  -- No authenticated identity → cannot attribute the request. Allow it: the Edge
  -- Function has already verified the user out-of-band before calling this.
  IF v_user IS NULL THEN
    RETURN TRUE;
  END IF;

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

  -- Prune rows older than 2x the window to keep the table small.
  DELETE FROM public.api_rate_limits
  WHERE user_id = v_user
    AND endpoint = p_endpoint
    AND requested_at < NOW() - ((p_window_minutes * 2) || ' minutes')::interval;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_edge_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_edge_rate_limit(uuid, text, int, int) TO authenticated;

-- check_rest_rate_limit already derives the user from auth.uid() internally, so
-- it is not spoofable. Just ensure it is not callable by PUBLIC.
REVOKE ALL ON FUNCTION public.check_rest_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rest_rate_limit(text, int, int) TO authenticated;

-- NOTE on check_auth_rate_limit (migration 006): it is intentionally left
-- callable pre-auth (the sign-in throttle runs before a session exists, so it
-- must accept the email identifier and be reachable by anon). Per the review it
-- is treated as UX friction only — the real auth-abuse defenses are Supabase
-- Auth's built-in limits and the hCaptcha protection now enabled.

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. PUBLIC can no longer execute (expect authenticated only):
--    SELECT proname, proacl FROM pg_proc WHERE proname IN
--      ('check_edge_rate_limit','check_rest_rate_limit');
-- 2. search_path pinned:
--    SELECT proname, proconfig FROM pg_proc WHERE proname = 'check_edge_rate_limit';
-- 3. Spoofing is dead: calling with another user's UUID only ever touches the
--    caller's own auth.uid() bucket.

-- ============================================================================
-- DOWN (rollback) — restore the migration 005 definition (search_path=public,
-- trusts p_user_id). Not recommended.
-- ============================================================================
