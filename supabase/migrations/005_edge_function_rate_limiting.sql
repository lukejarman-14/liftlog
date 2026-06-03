-- ============================================================================
-- Edge Function Rate Limiting
-- ============================================================================
-- Prevents spam/abuse on Stripe-related Edge Functions.
-- Uses a rolling-window counter stored in Postgres.
--
-- Limits (enforced server-side, not client-side):
--   create-checkout-session : 10 requests per hour per user
--   create-portal-session   : 20 requests per hour per user
-- ============================================================================

-- Rolling log of API requests (one row per request, pruned automatically)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID         NOT NULL,
  endpoint     TEXT         NOT NULL,
  requested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup: user + endpoint + time window
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user_endpoint
  ON api_rate_limits (user_id, endpoint, requested_at DESC);

-- RLS: users can see their own records (read-only via policy).
-- INSERT/DELETE are blocked for direct client access — only the
-- SECURITY DEFINER function below can write to this table.
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_select_own"
  ON api_rate_limits FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- check_edge_rate_limit
-- ============================================================================
-- Called by Edge Functions after JWT verification.
-- Returns TRUE  → request allowed (and logged).
-- Returns FALSE → rate limit exceeded (request should be rejected with 429).
--
-- SECURITY DEFINER so it can bypass RLS and write to api_rate_limits even
-- though no direct INSERT policy exists for users.
-- search_path is pinned to prevent search-path injection.
-- ============================================================================
CREATE OR REPLACE FUNCTION check_edge_rate_limit(
  p_user_id        UUID,
  p_endpoint       TEXT,
  p_max_requests   INT,
  p_window_minutes INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INT;
BEGIN
  -- Count requests within the rolling window
  SELECT COUNT(*) INTO recent_count
  FROM api_rate_limits
  WHERE user_id    = p_user_id
    AND endpoint   = p_endpoint
    AND requested_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Reject if at or over limit
  IF recent_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  -- Log this request
  INSERT INTO api_rate_limits (user_id, endpoint, requested_at)
  VALUES (p_user_id, p_endpoint, NOW());

  -- Prune records older than 2× the window to keep the table small
  DELETE FROM api_rate_limits
  WHERE user_id  = p_user_id
    AND endpoint = p_endpoint
    AND requested_at < NOW() - ((p_window_minutes * 2) || ' minutes')::INTERVAL;

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP FUNCTION IF EXISTS check_edge_rate_limit(UUID, TEXT, INT, INT);
-- DROP TABLE IF EXISTS api_rate_limits;
-- ============================================================================
