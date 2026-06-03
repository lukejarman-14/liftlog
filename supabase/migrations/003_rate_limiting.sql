-- ============================================================================
-- Rate Limiting for Coach Operations
-- ============================================================================
-- Prevents spam/abuse on announcements, attendance, and match results
-- by limiting how many of each operation a coach can perform per time window.
--
-- Limits:
--   - Announcements: 20 per hour per coach
--   - Attendance records: 100 per day per coach (one session can have many rows)
--   - Match results: 50 per day per coach
-- ============================================================================

-- ============================================================================
-- 1. ANNOUNCEMENTS: 20 per hour
-- ============================================================================
CREATE OR REPLACE FUNCTION check_announcement_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM coach_announcements
  WHERE coach_id = NEW.coach_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 20 announcements per hour';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_announcement_rate_limit_trigger ON coach_announcements;
CREATE TRIGGER check_announcement_rate_limit_trigger
BEFORE INSERT ON coach_announcements
FOR EACH ROW
EXECUTE FUNCTION check_announcement_rate_limit();

-- ============================================================================
-- 2. ATTENDANCE: 100 records per day
-- ============================================================================
CREATE OR REPLACE FUNCTION check_attendance_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM session_attendance
  WHERE coach_id = NEW.coach_id
    AND created_at > NOW() - INTERVAL '1 day';

  IF recent_count >= 100 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 100 attendance records per day';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_attendance_rate_limit_trigger ON session_attendance;
CREATE TRIGGER check_attendance_rate_limit_trigger
BEFORE INSERT ON session_attendance
FOR EACH ROW
EXECUTE FUNCTION check_attendance_rate_limit();

-- ============================================================================
-- 3. MATCH RESULTS: 50 per day
-- ============================================================================
CREATE OR REPLACE FUNCTION check_match_result_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM match_results
  WHERE coach_id = NEW.coach_id
    AND created_at > NOW() - INTERVAL '1 day';

  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 50 match results per day';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_match_result_rate_limit_trigger ON match_results;
CREATE TRIGGER check_match_result_rate_limit_trigger
BEFORE INSERT ON match_results
FOR EACH ROW
EXECUTE FUNCTION check_match_result_rate_limit();

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP TRIGGER IF EXISTS check_announcement_rate_limit_trigger ON coach_announcements;
-- DROP FUNCTION IF EXISTS check_announcement_rate_limit();
-- DROP TRIGGER IF EXISTS check_attendance_rate_limit_trigger ON session_attendance;
-- DROP FUNCTION IF EXISTS check_attendance_rate_limit();
-- DROP TRIGGER IF EXISTS check_match_result_rate_limit_trigger ON match_results;
-- DROP FUNCTION IF EXISTS check_match_result_rate_limit();
-- ============================================================================
