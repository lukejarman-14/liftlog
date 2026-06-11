-- ============================================================================
-- 023 - Harden delete_user() so "Delete Account & All Data" removes every
-- user-owned row before deleting auth.users.
--
-- This replaces the older function that only deleted user_data and then relied
-- on FK cascades. Cascades still help, but explicit deletes protect tables that
-- use text ids, rate-limit ledgers, or coach/player ownership columns.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_text text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_user_text := v_user::text;

  -- Coach/player tables. Delete child rows before parent squad/profile rows.
  DELETE FROM public.coach_player_notes
   WHERE coach_id = v_user OR player_id = v_user;

  DELETE FROM public.match_squads
   WHERE coach_id = v_user OR player_id = v_user;

  DELETE FROM public.session_attendance
   WHERE coach_id = v_user OR player_id = v_user;

  DELETE FROM public.coach_announcements
   WHERE coach_id = v_user;

  DELETE FROM public.coach_schedule
   WHERE coach_id = v_user;

  DELETE FROM public.match_results
   WHERE coach_id = v_user;

  DELETE FROM public.squad_members
   WHERE coach_id = v_user OR player_id = v_user;

  DELETE FROM public.coach_squads
   WHERE coach_id = v_user;

  DELETE FROM public.player_profiles
   WHERE player_id = v_user;

  -- Account, billing, entitlement, referral, promo, and sync data.
  DELETE FROM public.promo_redemptions
   WHERE user_id = v_user;

  DELETE FROM public.referrals
   WHERE referred_user_id = v_user_text OR referrer_user_id = v_user_text;

  DELETE FROM public.referral_codes
   WHERE user_id = v_user_text;

  DELETE FROM public.stripe_customers
   WHERE user_id = v_user;

  DELETE FROM public.entitlements
   WHERE user_id = v_user;

  DELETE FROM public.api_rate_limits
   WHERE user_id = v_user;

  DELETE FROM public.rest_rate_limits
   WHERE user_id = v_user;

  DELETE FROM public.user_data
   WHERE id = v_user;

  -- Finally delete the Supabase Auth account. Remaining FK rows with
  -- ON DELETE CASCADE are removed here as a final backstop.
  DELETE FROM auth.users
   WHERE id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
