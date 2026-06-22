-- ============================================================================
-- 017 — Put get_squad_members into version control + harden
-- ============================================================================
-- This function was created manually (not in migrations) so it wasn't reviewable.
-- Now it's formally versioned, with search_path pinning and explicit permission grants.
--
-- Authorization is already correct: auth.uid() must equal p_coach_id (coach
-- can only fetch their own squad). Returns email + full_name (PII), but only
-- to the coach, so exposure is limited. We minimize by not returning raw metadata.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_squad_members(p_coach_id uuid)
RETURNS TABLE(player_id uuid, joined_at timestamp with time zone, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only the coach can query their own squad. auth.uid() lives in the auth
  -- schema (NOT public) — must stay schema-qualified under search_path=''.
  IF auth.uid() != p_coach_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT sm.player_id, sm.joined_at,
         au.email::text,
         COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) AS full_name
  FROM public.squad_members sm
  JOIN auth.users au ON au.id = sm.player_id   -- auth.users is in the auth schema
  WHERE sm.coach_id = p_coach_id;
END;
$$;

-- Defensive: explicitly revoke from PUBLIC (it should not be PUBLIC callable).
REVOKE ALL ON FUNCTION public.get_squad_members(uuid) FROM PUBLIC;
-- Coaches need to call this to list their squad.
GRANT EXECUTE ON FUNCTION public.get_squad_members(uuid) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Coach A can query their own squad:
--    SELECT * FROM public.get_squad_members(auth.uid());  -- returns rows
-- 2. Coach A cannot query Coach B's squad:
--    SELECT * FROM public.get_squad_members('<coach-b-uuid>');  -- raises exception
-- 3. Anonymous cannot call it:
--    SELECT * FROM public.get_squad_members('<any-uuid>');  -- permission denied

-- ============================================================================
-- DOWN (rollback) — function remains in place; just remove the explicit grants
-- ============================================================================
-- REVOKE EXECUTE ON FUNCTION public.get_squad_members(uuid) FROM authenticated;
-- ============================================================================
