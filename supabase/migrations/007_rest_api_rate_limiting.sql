-- ============================================================================
-- REST API Rate Limiting (no Supabase Pro required)
-- ============================================================================
-- Protects direct REST API calls to core tables via RLS policy checks.
-- Uses a SECURITY DEFINER function embedded in RLS USING clauses so every
-- SELECT on user_data is rate-limited at the database level.
--
-- Limit: 120 reads per minute per authenticated user (2/sec sustained).
-- Exceeding the limit returns 0 rows — not an error — so the app degrades
-- gracefully rather than crashing. Attackers get nothing useful.
--
-- Covers the gap where someone uses a valid auth token to hammer
-- GET /rest/v1/user_data directly, bypassing edge function rate limits.
-- ============================================================================

-- ============================================================================
-- 1. Rate limit log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS rest_rate_limits (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID         NOT NULL,
  table_name   TEXT         NOT NULL,
  requested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rest_rate_limits_user_table
  ON rest_rate_limits (user_id, table_name, requested_at DESC);

-- RLS: users can see their own records; only the SECURITY DEFINER function
-- can write to this table.
ALTER TABLE rest_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rest_rate_limits_select_own" ON rest_rate_limits;
CREATE POLICY "rest_rate_limits_select_own"
  ON rest_rate_limits FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 2. check_rest_rate_limit()
-- ============================================================================
-- Returns TRUE  → request allowed (and logged).
-- Returns FALSE → rate limit exceeded; RLS USING clause returns 0 rows.
--
-- SECURITY DEFINER: bypasses RLS to write the log row.
-- search_path pinned to prevent search-path injection.
-- ============================================================================
CREATE OR REPLACE FUNCTION check_rest_rate_limit(
  p_table_name     TEXT,
  p_max_requests   INT  DEFAULT 120,
  p_window_seconds INT  DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  recent_count INT;
BEGIN
  -- Unauthenticated callers: let RLS handle it (uid() = null → no rows anyway)
  IF v_user_id IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM rest_rate_limits
  WHERE user_id    = v_user_id
    AND table_name = p_table_name
    AND requested_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF recent_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  -- Log this request
  INSERT INTO rest_rate_limits (user_id, table_name, requested_at)
  VALUES (v_user_id, p_table_name, NOW());

  -- Prune records older than 2× the window to keep the table small
  DELETE FROM rest_rate_limits
  WHERE user_id    = v_user_id
    AND table_name = p_table_name
    AND requested_at < NOW() - ((p_window_seconds * 2) || ' seconds')::INTERVAL;

  RETURN TRUE;
END;
$$;

-- Grant to authenticated only — anon users are already blocked by RLS
GRANT EXECUTE ON FUNCTION check_rest_rate_limit(TEXT, INT, INT) TO authenticated;

-- ============================================================================
-- 3. Patch RLS policies on user_data to include rate limit check
-- ============================================================================
-- Drop and recreate the SELECT policy only — insert/update/delete are
-- mutation ops and are naturally protected by auth + RLS ownership checks.
-- ============================================================================
DROP POLICY IF EXISTS "user_data_select_own" ON user_data;

CREATE POLICY "user_data_select_own"
  ON user_data FOR SELECT
  USING (
    id = auth.uid()
    AND check_rest_rate_limit('user_data', 120, 60)
  );

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS "user_data_select_own" ON user_data;
-- CREATE POLICY "user_data_select_own" ON user_data FOR SELECT USING (id = auth.uid());
-- REVOKE EXECUTE ON FUNCTION check_rest_rate_limit(TEXT, INT, INT) FROM authenticated;
-- DROP FUNCTION IF EXISTS check_rest_rate_limit(TEXT, INT, INT);
-- DROP TABLE IF EXISTS rest_rate_limits;
-- ============================================================================
