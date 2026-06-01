-- ============================================================
-- delete_user() — called by cloudDeleteAccount() in cloudSync.ts
--
-- Allows a user to permanently delete their own auth account.
-- SECURITY DEFINER means it runs with elevated privileges so it
-- can delete from auth.users (which the anon/user role cannot).
-- The WHERE clause is auth.uid() so it can only ever delete
-- the calling user — no privilege escalation possible.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this file → Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the user's app data first (belt-and-braces alongside CASCADE)
  DELETE FROM public.user_data WHERE id = auth.uid();

  -- Delete the auth account — requires SECURITY DEFINER
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Revoke public execute, then grant only to authenticated users.
-- Anonymous callers must never be able to invoke this.
REVOKE ALL ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
