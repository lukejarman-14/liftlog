-- ============================================================================
-- Coach & Club Feature: Row-Level Security Policies
-- ============================================================================
-- This migration implements RLS policies for the coaching feature to prevent
-- cross-coach data access and ensure data isolation in multi-tenant scenarios.
--
-- CRITICAL: Deploy this BEFORE releasing the coach feature to production.
-- Without these policies, a compromised auth token allows lateral movement
-- across all coaches' data.
-- ============================================================================

-- ============================================================================
-- 1. COACH_SQUADS: Coaches can only see/edit their own squads
-- ============================================================================
ALTER TABLE coach_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_squads_select_own"
  ON coach_squads
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "coach_squads_insert_own"
  ON coach_squads
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_squads_update_own"
  ON coach_squads
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_squads_delete_own"
  ON coach_squads
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- 2. SQUAD_MEMBERS: Coaches can only see members of their own squads
-- ============================================================================
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squad_members_select_own"
  ON squad_members
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "squad_members_insert_own"
  ON squad_members
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "squad_members_update_own"
  ON squad_members
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "squad_members_delete_own"
  ON squad_members
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- 3. COACH_ANNOUNCEMENTS: Coaches can only see/edit their own announcements
-- ============================================================================
ALTER TABLE coach_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_announcements_select_own"
  ON coach_announcements
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "coach_announcements_insert_own"
  ON coach_announcements
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_announcements_update_own"
  ON coach_announcements
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_announcements_delete_own"
  ON coach_announcements
  FOR DELETE
  USING (coach_id = auth.uid());

-- PLAYERS: Can read announcements from their own coach
-- This requires a join through squad_members → coach_squads
CREATE POLICY "coach_announcements_select_as_player"
  ON coach_announcements
  FOR SELECT
  USING (
    coach_id IN (
      SELECT DISTINCT coach_id FROM squad_members
      WHERE player_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. COACH_SCHEDULE: Coaches can only see/edit their own schedules
-- ============================================================================
ALTER TABLE coach_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_schedule_select_own"
  ON coach_schedule
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "coach_schedule_insert_own"
  ON coach_schedule
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_schedule_update_own"
  ON coach_schedule
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_schedule_delete_own"
  ON coach_schedule
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- 5. SESSION_ATTENDANCE: Coaches can only see attendance for their own squads
-- ============================================================================
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_attendance_select_own"
  ON session_attendance
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "session_attendance_insert_own"
  ON session_attendance
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "session_attendance_update_own"
  ON session_attendance
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "session_attendance_delete_own"
  ON session_attendance
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- 6. MATCH_RESULTS: Coaches can only see results for their own squads
-- ============================================================================
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_select_own"
  ON match_results
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "match_results_insert_own"
  ON match_results
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "match_results_update_own"
  ON match_results
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "match_results_delete_own"
  ON match_results
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- 7. MATCH_SQUADS: Coaches can only see squads they created
-- ============================================================================
ALTER TABLE match_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_squads_select_own"
  ON match_squads
  FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "match_squads_insert_own"
  ON match_squads
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "match_squads_update_own"
  ON match_squads
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "match_squads_delete_own"
  ON match_squads
  FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================================================
-- INDEXES: Performance optimization for common queries
-- ============================================================================

-- Coach data isolation lookups
CREATE INDEX IF NOT EXISTS idx_coach_squads_coach_id ON coach_squads(coach_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_coach_id ON squad_members(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_announcements_coach_id ON coach_announcements(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_schedule_coach_id ON coach_schedule(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_coach_id ON session_attendance(coach_id);
CREATE INDEX IF NOT EXISTS idx_match_results_coach_id ON match_results(coach_id);
CREATE INDEX IF NOT EXISTS idx_match_squads_coach_id ON match_squads(coach_id);

-- Formation queries
CREATE INDEX IF NOT EXISTS idx_match_squads_formation ON match_squads(coach_id, match_date)
  WHERE formation_data IS NOT NULL;

-- Squad member queries
CREATE INDEX IF NOT EXISTS idx_squad_members_player_id ON squad_members(player_id);

-- Session attendance grouping
CREATE INDEX IF NOT EXISTS idx_session_attendance_date_coach
  ON session_attendance(coach_id, session_date, session_title);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- After deploying this migration, run these checks:

-- 1. Verify all tables have RLS enabled:
--    SELECT tablename FROM pg_tables WHERE schemaname='public'
--    AND tablename LIKE '%coach%' OR tablename LIKE '%squad%' OR tablename = 'match_squads';
--    SELECT * FROM pg_policies WHERE tablename IN ('coach_squads', 'squad_members', 'coach_announcements', ...);

-- 2. Test RLS isolation (must use a new Supabase client with different user tokens):
--    - Create Coach A with auth.uid() = user_a_id
--    - Create Coach B with auth.uid() = user_b_id
--    - Verify Coach A cannot select rows with coach_id = user_b_id
--    - Verify Coach B cannot select rows with coach_id = user_a_id

-- ============================================================================
-- DOWN (rollback) — run this to undo the migration if needed
-- ============================================================================
-- ALTER TABLE coach_squads DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "coach_squads_select_own" ON coach_squads;
-- DROP POLICY IF EXISTS "coach_squads_insert_own" ON coach_squads;
-- DROP POLICY IF EXISTS "coach_squads_update_own" ON coach_squads;
-- DROP POLICY IF EXISTS "coach_squads_delete_own" ON coach_squads;
-- ALTER TABLE squad_members DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "squad_members_select_own" ON squad_members;
-- DROP POLICY IF EXISTS "squad_members_insert_own" ON squad_members;
-- DROP POLICY IF EXISTS "squad_members_update_own" ON squad_members;
-- DROP POLICY IF EXISTS "squad_members_delete_own" ON squad_members;
-- ALTER TABLE coach_announcements DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "coach_announcements_select_own" ON coach_announcements;
-- DROP POLICY IF EXISTS "coach_announcements_insert_own" ON coach_announcements;
-- DROP POLICY IF EXISTS "coach_announcements_update_own" ON coach_announcements;
-- DROP POLICY IF EXISTS "coach_announcements_delete_own" ON coach_announcements;
-- DROP POLICY IF EXISTS "coach_announcements_select_as_player" ON coach_announcements;
-- ALTER TABLE coach_schedule DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "coach_schedule_select_own" ON coach_schedule;
-- DROP POLICY IF EXISTS "coach_schedule_insert_own" ON coach_schedule;
-- DROP POLICY IF EXISTS "coach_schedule_update_own" ON coach_schedule;
-- DROP POLICY IF EXISTS "coach_schedule_delete_own" ON coach_schedule;
-- ALTER TABLE session_attendance DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "session_attendance_select_own" ON session_attendance;
-- DROP POLICY IF EXISTS "session_attendance_insert_own" ON session_attendance;
-- DROP POLICY IF EXISTS "session_attendance_update_own" ON session_attendance;
-- DROP POLICY IF EXISTS "session_attendance_delete_own" ON session_attendance;
-- ALTER TABLE match_results DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "match_results_select_own" ON match_results;
-- DROP POLICY IF EXISTS "match_results_insert_own" ON match_results;
-- DROP POLICY IF EXISTS "match_results_update_own" ON match_results;
-- DROP POLICY IF EXISTS "match_results_delete_own" ON match_results;
-- ALTER TABLE match_squads DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "match_squads_select_own" ON match_squads;
-- DROP POLICY IF EXISTS "match_squads_insert_own" ON match_squads;
-- DROP POLICY IF EXISTS "match_squads_update_own" ON match_squads;
-- DROP POLICY IF EXISTS "match_squads_delete_own" ON match_squads;
-- ============================================================================
