-- ============================================================================
-- 024 - Launch readiness hardening
--
-- Cleans up legacy hand-made policies/grants that remained in production after
-- the security migrations were recorded. This is intentionally a new migration:
-- production already has 001-023 recorded, so we do not rewrite history.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remove legacy permissive referral policies.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can read and update own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can update referrals" ON public.referrals;

-- Re-assert the intended referral policies.
DROP POLICY IF EXISTS "referrals_select_own" ON public.referrals;
CREATE POLICY "referrals_select_own"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (
    referred_user_id = auth.uid()::text
    OR referrer_user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "referrals_update_referrer" ON public.referrals;
CREATE POLICY "referrals_update_referrer"
  ON public.referrals FOR UPDATE
  TO authenticated
  USING (referrer_user_id = auth.uid()::text)
  WITH CHECK (referrer_user_id = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 2. Remove legacy direct squad-membership policies. Membership creation must
--    go through join_squad(), where code validation/rate limit/seat cap live.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coach sees squad members" ON public.squad_members;
DROP POLICY IF EXISTS "coach reads members" ON public.squad_members;
DROP POLICY IF EXISTS "Player manages own membership" ON public.squad_members;
DROP POLICY IF EXISTS "player manages own membership" ON public.squad_members;

DROP POLICY IF EXISTS "squad_members_select_own" ON public.squad_members;
CREATE POLICY "squad_members_select_own"
  ON public.squad_members FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "squad_members_delete_own" ON public.squad_members;
CREATE POLICY "squad_members_delete_own"
  ON public.squad_members FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "squad_members_select_as_player" ON public.squad_members;
CREATE POLICY "squad_members_select_as_player"
  ON public.squad_members FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Remove duplicate broad user_data policy. Keep the explicit policies from
--    migration 002/007, including the rate-limited SELECT policy.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "own data only" ON public.user_data;

-- ----------------------------------------------------------------------------
-- 4. Pin remaining trigger-function search paths and qualify table names.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_announcement_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.coach_announcements
  WHERE coach_id = NEW.coach_id
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 20 announcements per hour';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_attendance_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.session_attendance
  WHERE coach_id = NEW.coach_id
    AND created_at > now() - interval '1 day';

  IF recent_count >= 100 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 100 attendance records per day';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_match_result_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.match_results
  WHERE coach_id = NEW.coach_id
    AND created_at > now() - interval '1 day';

  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 50 match results per day';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_announcement_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_attendance_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_match_result_rate_limit() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Harden auth/rest rate-limit functions. check_auth_rate_limit intentionally
--    remains callable by anon because it runs before login.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(
  p_identifier text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hashed text := encode(sha256(p_identifier::bytea), 'hex');
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.auth_attempts
  WHERE identifier = hashed
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  IF recent_count >= p_max_attempts THEN
    RETURN false;
  END IF;

  INSERT INTO public.auth_attempts (identifier, attempted_at)
  VALUES (hashed, now());

  DELETE FROM public.auth_attempts
  WHERE identifier = hashed
    AND attempted_at < now() - ((p_window_minutes * 2) || ' minutes')::interval;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_auth_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text, integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rest_rate_limit(
  p_table_name text,
  p_max_requests integer DEFAULT 120,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  recent_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.rest_rate_limits
  WHERE user_id = v_user_id
    AND table_name = p_table_name
    AND requested_at > now() - (p_window_seconds || ' seconds')::interval;

  IF recent_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rest_rate_limits (user_id, table_name, requested_at)
  VALUES (v_user_id, p_table_name, now());

  DELETE FROM public.rest_rate_limits
  WHERE user_id = v_user_id
    AND table_name = p_table_name
    AND requested_at < now() - ((p_window_seconds * 2) || ' seconds')::interval;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rest_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rest_rate_limit(text, integer, integer) TO authenticated;

-- check_edge_rate_limit is already search_path-pinned by migration 019; remove
-- legacy anon/public grants and keep authenticated only.
REVOKE ALL ON FUNCTION public.check_edge_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_edge_rate_limit(uuid, text, integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Remove anon/public execute from authenticated-only SECURITY DEFINER RPCs.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_entitlement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;

REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_squad(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_squad(text) TO authenticated;

REVOKE ALL ON FUNCTION public.register_squad(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_squad(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_squad_members(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_squad_members(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_referral_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_owner(text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_paid_entitlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_entitlement(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_email_confirmed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_confirmed() TO authenticated;

REVOKE ALL ON FUNCTION public.enforce_referral_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_squad_seat_cap() FROM PUBLIC, anon, authenticated;
