-- 025: Reap abandoned, never-confirmed signups.
--
-- The onboarding "change email" flow (and ordinary typos) can leave behind
-- unconfirmed auth.users rows that are never used. This removes only the ones
-- that are genuinely abandoned and carry NO user data:
--   * email_confirmed_at IS NULL  (never confirmed), AND
--   * created_at older than 7 days (well past any reasonable confirm window), AND
--   * no entitlement row, AND
--   * no user_data row.
-- Anything with data or an entitlement is left untouched — fail-safe by design.

create or replace function public.cleanup_unconfirmed_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with abandoned as (
    select u.id
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - interval '7 days'
      and not exists (select 1 from public.entitlements e where e.user_id = u.id)
      and not exists (select 1 from public.user_data d where d.id = u.id)
  )
  delete from auth.users where id in (select id from abandoned);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Never callable by clients — server/cron only.
revoke all on function public.cleanup_unconfirmed_users() from public;

-- ---------------------------------------------------------------------------
-- Schedule it daily (03:30 UTC). Requires the pg_cron extension:
--   Dashboard → Database → Extensions → enable "pg_cron"  (or uncomment below).
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;

-- select cron.schedule(
--   'cleanup-unconfirmed-users',
--   '30 3 * * *',
--   $$ select public.cleanup_unconfirmed_users(); $$
-- );

-- Run once manually any time:  select public.cleanup_unconfirmed_users();

-- ===========================================================================
-- DOWN (rollback)
-- ===========================================================================
-- select cron.unschedule('cleanup-unconfirmed-users');
-- drop function if exists public.cleanup_unconfirmed_users();
