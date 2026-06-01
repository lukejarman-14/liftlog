-- ============================================================
-- Test promo code: VECTORVIP
--
-- Grants 30 days of full premium when redeemed in-app via the
-- Paywall screen → "Have a promo code?". Used for testing premium
-- features while the RevenueCat free-trial purchase flow is fixed.
--
-- redeemPromoCode() (src/lib/promoCodes.ts) only reads `code` + `active`,
-- so those are the only columns required. ON CONFLICT makes this safe
-- to run more than once.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this → Run.
-- ============================================================

insert into public.promo_codes (code, active)
values ('VECTORVIP', true)
on conflict (code) do update set active = true;
