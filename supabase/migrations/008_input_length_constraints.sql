-- ============================================================================
-- Input Length Constraints — belt-and-braces server-side validation
-- ============================================================================
-- The frontend already enforces maxLength on all text inputs.
-- These CHECK constraints are a server-side backstop: even if someone
-- bypasses the UI and calls the REST API directly, oversized payloads
-- are rejected at the database level.
-- ============================================================================

-- player_profiles: name fields
-- NOTE: player_profiles has `display_name` (not first_name/last_name — those
-- never existed, so the original constraints made this migration fail).
ALTER TABLE player_profiles DROP CONSTRAINT IF EXISTS chk_display_name_length;
ALTER TABLE player_profiles
  ADD CONSTRAINT chk_display_name_length CHECK (char_length(display_name) <= 100) NOT VALID;

-- coach_announcements: announcement body
ALTER TABLE coach_announcements DROP CONSTRAINT IF EXISTS chk_announcement_text_length;
ALTER TABLE coach_announcements
  ADD CONSTRAINT chk_announcement_text_length CHECK (char_length(text) <= 500) NOT VALID;

-- (coach_player_notes length cap moved to migration 021, which CREATES that
--  table — referencing it here failed because the table didn't exist yet.)

-- coach_schedule: session title and description
ALTER TABLE coach_schedule DROP CONSTRAINT IF EXISTS chk_schedule_label_length;
ALTER TABLE coach_schedule DROP CONSTRAINT IF EXISTS chk_schedule_description_length;
ALTER TABLE coach_schedule
  ADD CONSTRAINT chk_schedule_label_length       CHECK (char_length(label)       <= 100) NOT VALID,
  ADD CONSTRAINT chk_schedule_description_length CHECK (char_length(description) <= 300) NOT VALID;

-- match_results: opponent name and notes
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS chk_match_opponent_length;
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS chk_match_notes_length;
ALTER TABLE match_results
  ADD CONSTRAINT chk_match_opponent_length CHECK (char_length(opponent)    <= 100) NOT VALID,
  ADD CONSTRAINT chk_match_notes_length    CHECK (char_length(notes)       <= 1000) NOT VALID;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- ALTER TABLE player_profiles      DROP CONSTRAINT IF EXISTS chk_first_name_length;
-- ALTER TABLE player_profiles      DROP CONSTRAINT IF EXISTS chk_last_name_length;
-- ALTER TABLE coach_announcements  DROP CONSTRAINT IF EXISTS chk_announcement_text_length;
-- ALTER TABLE coach_player_notes   DROP CONSTRAINT IF EXISTS chk_coach_notes_length;
-- ALTER TABLE coach_schedule       DROP CONSTRAINT IF EXISTS chk_schedule_label_length;
-- ALTER TABLE coach_schedule       DROP CONSTRAINT IF EXISTS chk_schedule_description_length;
-- ALTER TABLE match_results        DROP CONSTRAINT IF EXISTS chk_match_opponent_length;
-- ALTER TABLE match_results        DROP CONSTRAINT IF EXISTS chk_match_notes_length;
-- ============================================================================
