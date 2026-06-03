-- ============================================================================
-- Auth Rate Limiting
-- ============================================================================
-- Prevents brute-force password attacks and email enumeration.
-- Called from the frontend BEFORE every auth operation (signIn, signUp,
-- resetPassword). If the limit is exceeded the client throws an error
-- and never reaches Supabase's GoTrue endpoint.
--
-- Limit: 5 attempts per 15 minutes per email address.
--
-- The email is hashed (SHA-256) before storage so plaintext addresses
-- never appear in the table even under service-role access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_attempts (
  id           BIGSERIAL    PRIMARY KEY,
  identifier   TEXT         NOT NULL, -- SHA-256 hash of email — never plaintext
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast rolling-window lookup
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier
  ON auth_attempts (identifier, attempted_at DESC);

-- RLS enabled — no user-facing policies.
-- Clients cannot query this table directly; only the SECURITY DEFINER
-- function below can read and write it.
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- check_auth_rate_limit
-- ============================================================================
-- Returns TRUE  → attempt allowed (and logged).
-- Returns FALSE → rate limit exceeded; caller should return 429 / error.
--
-- p_identifier   : raw email address — hashed internally, never stored plain.
-- p_max_attempts : max requests in the window (default 5).
-- p_window_minutes: rolling window length in minutes (default 15).
--
-- SECURITY DEFINER so it can bypass RLS to write to auth_attempts.
-- Granted to anon so it is callable before a session exists.
-- ============================================================================
CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_identifier     TEXT,
  p_max_attempts   INT  DEFAULT 5,
  p_window_minutes INT  DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashed       TEXT := encode(sha256(p_identifier::bytea), 'hex');
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM auth_attempts
  WHERE identifier    = hashed
    AND attempted_at  > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF recent_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  INSERT INTO auth_attempts (identifier, attempted_at)
  VALUES (hashed, NOW());

  -- Prune records older than 2× the window to keep the table small
  DELETE FROM auth_attempts
  WHERE identifier   = hashed
    AND attempted_at < NOW() - ((p_window_minutes * 2) || ' minutes')::INTERVAL;

  RETURN TRUE;
END;
$$;

-- Grant to anon (pre-login) and authenticated roles
GRANT EXECUTE ON FUNCTION check_auth_rate_limit(TEXT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION check_auth_rate_limit(TEXT, INT, INT) TO authenticated;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- REVOKE EXECUTE ON FUNCTION check_auth_rate_limit(TEXT, INT, INT) FROM anon;
-- REVOKE EXECUTE ON FUNCTION check_auth_rate_limit(TEXT, INT, INT) FROM authenticated;
-- DROP FUNCTION IF EXISTS check_auth_rate_limit(TEXT, INT, INT);
-- DROP TABLE IF EXISTS auth_attempts;
-- ============================================================================
