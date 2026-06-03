-- ============================================================================
-- Add coach notes column to player_profiles
-- ============================================================================
-- Allows coaches to add private notes about each player in their squad.
-- Notes are scoped to the player, so each coach's notes are independent.
-- ============================================================================

ALTER TABLE player_profiles
ADD COLUMN coach_notes TEXT DEFAULT NULL;

-- Index for fast lookups when loading a player's profile
CREATE INDEX IF NOT EXISTS idx_player_profiles_coach_notes ON player_profiles(player_id);

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- ALTER TABLE player_profiles DROP COLUMN IF EXISTS coach_notes;
-- DROP INDEX IF EXISTS idx_player_profiles_coach_notes;
-- ============================================================================
