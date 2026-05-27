-- Migration: promo_redemptions
-- Tracks per-user promo code redemptions server-side, preventing code sharing across devices.
-- A unique constraint on (code, user_id) means each user can only redeem a given code once.

create table if not exists public.promo_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.promo_codes(code) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code, user_id)
);

-- Only the authenticated user may see their own redemptions.
-- Inserts are allowed so the client can record new redemptions.
alter table public.promo_redemptions enable row level security;

create policy "Users can view their own redemptions"
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own redemptions"
  on public.promo_redemptions for insert
  with check (auth.uid() = user_id);
