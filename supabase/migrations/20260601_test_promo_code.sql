-- ============================================================
-- Test promo code: VECTORVIP  — DEACTIVATED (do not ship active)
--
-- This guessable code was only ever for internal testing while the
-- RevenueCat trial flow was being fixed. Shipping it active in a
-- migration means any fresh/clean deploy would re-create a free-premium
-- code that anyone could guess. It is now force-deactivated here so a
-- clean `supabase db reset` never re-enables it.
--
-- Real promo codes must be high-entropy, expiring, and inserted out-of-band
-- (never committed active in a migration). See SECURITY_FIXES.md.
-- ============================================================

-- Ensure the row exists but is INACTIVE (idempotent, safe on clean deploy).
insert into public.promo_codes (code, active)
values ('VECTORVIP', false)
on conflict (code) do update set active = false;
