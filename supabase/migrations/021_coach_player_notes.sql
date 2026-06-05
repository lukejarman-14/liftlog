-- ============================================================================
-- 021 — Coach player notes: per-(coach, player) ownership
-- ============================================================================
-- Codex finding: notes were written to a single shared player_profiles.coach_notes
-- value (`UPDATE player_profiles SET coach_notes ...`). Problems:
--   1. One value per player → multiple coaches would overwrite each other.
--   2. Coaches only have SELECT on player_profiles, so the UPDATE failed anyway.
--   3. player_profiles has no coach_notes column in production (migration 004 was
--      never applied) — so the feature silently did nothing.
--
-- Fix: a dedicated table keyed by (coach_id, player_id). Each coach owns their own
-- notes about a player; RLS scopes everything to coach_id = auth.uid().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_player_notes (
  coach_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, player_id),
  -- The length cap migration 008 intended for coach notes now lives with the table.
  CONSTRAINT chk_coach_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

ALTER TABLE public.coach_player_notes ENABLE ROW LEVEL SECURITY;

-- A coach reads/writes ONLY the notes they authored. No cross-coach visibility.
DROP POLICY IF EXISTS "coach_player_notes_own" ON public.coach_player_notes;
CREATE POLICY "coach_player_notes_own"
  ON public.coach_player_notes
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Coach A upserts a note about Player X → succeeds.
-- 2. Coach B's note about Player X is independent (no overwrite).
-- 3. Coach A cannot read Coach B's notes (RLS: coach_id = auth.uid()).
-- 4. Note over 2000 chars is rejected by chk_coach_notes_length.

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP TABLE IF EXISTS public.coach_player_notes;
-- ============================================================================
