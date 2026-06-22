-- ============================================================================
-- 014 — Squad membership: RPC-only creation + player self-visibility
-- ============================================================================
-- Codex finding (P0): squad_members_insert_own only checks coach_id = auth.uid(),
-- NOT player_id. A coach could therefore INSERT any UUID as a "member" and then
-- read that user's player_profile (membership grants the coach read access).
--
-- The app never writes squad_members directly from the client — players join via
-- the hardened public.join_squad() RPC (migration 011), which is SECURITY DEFINER
-- and bypasses RLS. So removing the coach INSERT/UPDATE policies cannot break the
-- real join flow; it only closes the arbitrary-membership injection.
--
-- Codex finding (#21, functional): the "players can see their coach's
-- announcements" policy joins through squad_members, but players had NO policy
-- letting them SELECT their own membership row — so that subquery returned 0 rows
-- and announcements never appeared. Added a player self-SELECT policy.
-- ============================================================================

-- 1. Remove the over-broad coach write policies. Membership is created only via
--    the player-initiated join_squad RPC from here on.
DROP POLICY IF EXISTS "squad_members_insert_own" ON public.squad_members;
DROP POLICY IF EXISTS "squad_members_update_own" ON public.squad_members;

-- 2. Let a player see the membership rows that are about THEM (player_id = self).
--    Coaches still see their own squad via squad_members_select_own. This also
--    makes the coach_announcements "as player" policy resolve correctly.
DROP POLICY IF EXISTS "squad_members_select_as_player" ON public.squad_members;
CREATE POLICY "squad_members_select_as_player"
  ON public.squad_members
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- NOTE: squad_members_select_own (coach reads own squad) and
-- squad_members_delete_own (coach removes a member from own squad) are kept —
-- both are correctly scoped to coach_id = auth.uid().

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. No INSERT/UPDATE policy remains on squad_members:
--    SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='squad_members';
-- 2. Coach A can no longer inject Player B by UUID (direct REST INSERT fails RLS).
-- 3. A player joining via SELECT public.join_squad('<code>') still works.
-- 4. A player can now SELECT their own membership row (announcements visible).

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- CREATE POLICY "squad_members_insert_own" ON public.squad_members
--   FOR INSERT WITH CHECK (coach_id = auth.uid());
-- CREATE POLICY "squad_members_update_own" ON public.squad_members
--   FOR UPDATE USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
-- DROP POLICY IF EXISTS "squad_members_select_as_player" ON public.squad_members;
-- ============================================================================
