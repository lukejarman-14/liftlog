-- ============================================================================
-- 009 — Referral system hardening (anti-farming)
-- ============================================================================
-- Closes the referral-farming holes found in the security review:
--   1. Self-referral was only blocked in client code (bypassable via REST).
--   2. An account could be referred more than once.
--   3. Unconfirmed throwaway accounts could redeem codes at scale.
--   4. A single referrer had no cap on how many rewards they could farm.
--
-- Column types (verified against migration 002): referrals.referrer_user_id
-- and referred_user_id are TEXT, so auth.uid() is cast with ::text.
--
-- All functions use `SET search_path = ''` and fully-qualified object names to
-- prevent search-path injection (OWASP / Supabase best practice).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Shared helper — is the calling user's email confirmed?
--    Reused by promo + join_squad migrations. SECURITY DEFINER so it can read
--    auth.users; granted to authenticated only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_email_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_email_confirmed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_confirmed() TO authenticated;

-- ----------------------------------------------------------------------------
-- 1. Block self-referral at the data layer.
--    NOT VALID = enforced on all NEW rows immediately, but existing rows are
--    not re-checked — non-destructive, safe to run on a live table.
-- ----------------------------------------------------------------------------
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS chk_referrals_no_self;
ALTER TABLE public.referrals
  ADD CONSTRAINT chk_referrals_no_self
  CHECK (referrer_user_id <> referred_user_id) NOT VALID;

-- ----------------------------------------------------------------------------
-- 2. Each account may only ever be referred once.
--    NOTE: if duplicate referred_user_id rows already exist this will error.
--    Run the diagnostic first and clean up if needed:
--      SELECT referred_user_id, count(*) FROM public.referrals
--      GROUP BY 1 HAVING count(*) > 1;
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_referred_user
  ON public.referrals (referred_user_id);

-- ----------------------------------------------------------------------------
-- 3. Cap how many referrals one referrer can benefit from (anti-farming).
--    25 is generous for genuine word-of-mouth but stops automated abuse.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_referral_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int;
  c_cap   constant int := 25;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.referrals
  WHERE referrer_user_id = NEW.referrer_user_id;

  IF v_count >= c_cap THEN
    RAISE EXCEPTION 'referral_cap_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_cap ON public.referrals;
CREATE TRIGGER trg_referral_cap
  BEFORE INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_referral_cap();

-- ----------------------------------------------------------------------------
-- 4. Tighten the INSERT RLS policy.
--    Caller must (a) be the referred user, (b) not refer themselves, and
--    (c) have a confirmed email. This makes the REST-direct self-referral
--    attack impossible even if the client guard is bypassed.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "referrals_insert_own" ON public.referrals;
CREATE POLICY "referrals_insert_own"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    referred_user_id = auth.uid()::text
    AND referrer_user_id <> referred_user_id
    AND public.is_email_confirmed()
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Self-referral rejected:
--    INSERT INTO public.referrals (referral_code, referrer_user_id, referred_user_id, reward_applied)
--    VALUES ('X', auth.uid()::text, auth.uid()::text, false);   -- expect: violates RLS / CHECK
-- 2. Helper works:
--    SELECT public.is_email_confirmed();   -- expect: true for a confirmed session
-- 3. Cap trigger present:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.referrals'::regclass;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_referral_cap ON public.referrals;
-- DROP FUNCTION IF EXISTS public.enforce_referral_cap();
-- DROP INDEX IF EXISTS public.uq_referrals_referred_user;
-- ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS chk_referrals_no_self;
-- DROP POLICY IF EXISTS "referrals_insert_own" ON public.referrals;
-- CREATE POLICY "referrals_insert_own" ON public.referrals FOR INSERT
--   WITH CHECK (referred_user_id = auth.uid()::text);
-- DROP FUNCTION IF EXISTS public.is_email_confirmed();
-- ============================================================================
