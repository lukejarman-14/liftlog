-- ============================================================================
-- 016 — referral_codes: stop global enumeration, lookup via RPC only
-- ============================================================================
-- Codex finding: referral_codes had a permissive SELECT policy (USING (true)),
-- so anyone could list EVERY code and the associated user UUID — bulk PII /
-- account enumeration, and a map to derive squad codes.
--
-- Fix: drop all client SELECT policies. Clients may only read/write their OWN
-- code row (for registerReferralCode). Foreign-code validation during redemption
-- goes through a SECURITY DEFINER RPC that returns the owner for an EXACT code
-- only — one code in, one owner out, never the whole table.
--
-- referral_codes.user_id is TEXT (per migration 002), so auth.uid() is cast.
-- ============================================================================

-- Drop every existing policy regardless of name (some were added by hand).
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'referral_codes'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.referral_codes', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- A user may read/insert/update ONLY their own code row (registerReferralCode upsert).
DROP POLICY IF EXISTS "referral_codes_own" ON public.referral_codes;
CREATE POLICY "referral_codes_own"
  ON public.referral_codes FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Exact-match owner lookup used during redemption. Not enumerable in bulk.
CREATE OR REPLACE FUNCTION public.get_referral_owner(p_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT user_id FROM public.referral_codes
  WHERE code = upper(trim(coalesce(p_code, '')))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_referral_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_owner(text) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- 1. Bulk enumeration blocked (run as authenticated, not service role):
--    SELECT * FROM public.referral_codes;   -- expect only your own row (or none)
-- 2. Exact lookup works:
--    SELECT public.get_referral_owner('VF1234ABCD');  -- owner id or NULL
-- 3. Anonymous cannot enumerate: SELECT * FROM public.referral_codes; -- 0 rows

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.get_referral_owner(text);
-- DROP POLICY IF EXISTS "referral_codes_own" ON public.referral_codes;
-- CREATE POLICY "referral_codes_select_authenticated" ON public.referral_codes
--   FOR SELECT TO authenticated USING (true);
-- ============================================================================
