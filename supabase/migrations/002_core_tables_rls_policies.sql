-- ============================================================================
-- Core Tables: Row-Level Security Policies
-- ============================================================================
-- Covers the 4 tables identified in the security audit as missing RLS:
--   user_data       — full app data blob (premium status, training history)
--   player_profiles — display name, position, jersey number
--   referral_codes  — one row per user; readable by anon for code lookup
--   referrals       — referral redemption log
-- ============================================================================

-- ============================================================================
-- 1. USER_DATA — each user can only read/write their own row
-- ============================================================================
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- user_data.id is uuid — compare directly with auth.uid()
CREATE POLICY "user_data_select_own"
  ON user_data FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_data_insert_own"
  ON user_data FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_data_update_own"
  ON user_data FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_data_delete_own"
  ON user_data FOR DELETE
  USING (id = auth.uid());

-- ============================================================================
-- 2. PLAYER_PROFILES — each player can only read/write their own profile
--    Coaches can read profiles of players in their squad (via squad_members)
-- ============================================================================
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

-- Players can read and write their own profile
CREATE POLICY "player_profiles_select_own"
  ON player_profiles FOR SELECT
  USING (player_id = auth.uid());

CREATE POLICY "player_profiles_insert_own"
  ON player_profiles FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "player_profiles_update_own"
  ON player_profiles FOR UPDATE
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "player_profiles_delete_own"
  ON player_profiles FOR DELETE
  USING (player_id = auth.uid());

-- Coaches can read profiles of players in their squad
CREATE POLICY "player_profiles_select_as_coach"
  ON player_profiles FOR SELECT
  USING (
    player_id IN (
      SELECT player_id FROM squad_members
      WHERE coach_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. REFERRAL_CODES — users can write their own; anyone can look up by code
--    The anon (public) client is used intentionally to look up foreign codes.
--    RLS must allow SELECT by anon for the lookup to work.
-- ============================================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can look up a referral code by code value
-- This is intentional — codes are semi-public by design
CREATE POLICY "referral_codes_select_public"
  ON referral_codes FOR SELECT
  USING (true);

-- referral_codes.user_id is text — cast auth.uid() to text
CREATE POLICY "referral_codes_insert_own"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "referral_codes_update_own"
  ON referral_codes FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "referral_codes_delete_own"
  ON referral_codes FOR DELETE
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- 4. REFERRALS — users can read referrals they are part of; insert on redemption
-- ============================================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- referrals.referred_user_id + referrer_user_id are text — cast auth.uid() to text
CREATE POLICY "referrals_select_own"
  ON referrals FOR SELECT
  USING (
    referred_user_id = auth.uid()::text OR
    referrer_user_id = auth.uid()::text
  );

CREATE POLICY "referrals_insert_own"
  ON referrals FOR INSERT
  WITH CHECK (referred_user_id = auth.uid()::text);

CREATE POLICY "referrals_update_referrer"
  ON referrals FOR UPDATE
  USING (referrer_user_id = auth.uid()::text)
  WITH CHECK (referrer_user_id = auth.uid()::text);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_data_id ON user_data(id);
CREATE INDEX IF NOT EXISTS idx_player_profiles_player_id ON player_profiles(player_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user ON referrals(referrer_user_id);

-- ============================================================================
-- DOWN (rollback) — run this to undo the migration if needed
-- ============================================================================
-- ALTER TABLE user_data DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "user_data_select_own" ON user_data;
-- DROP POLICY IF EXISTS "user_data_insert_own" ON user_data;
-- DROP POLICY IF EXISTS "user_data_update_own" ON user_data;
-- DROP POLICY IF EXISTS "user_data_delete_own" ON user_data;
--
-- ALTER TABLE player_profiles DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "player_profiles_select_own" ON player_profiles;
-- DROP POLICY IF EXISTS "player_profiles_insert_own" ON player_profiles;
-- DROP POLICY IF EXISTS "player_profiles_update_own" ON player_profiles;
-- DROP POLICY IF EXISTS "player_profiles_delete_own" ON player_profiles;
-- DROP POLICY IF EXISTS "player_profiles_select_as_coach" ON player_profiles;
--
-- ALTER TABLE referral_codes DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "referral_codes_select_public" ON referral_codes;
-- DROP POLICY IF EXISTS "referral_codes_insert_own" ON referral_codes;
-- DROP POLICY IF EXISTS "referral_codes_update_own" ON referral_codes;
-- DROP POLICY IF EXISTS "referral_codes_delete_own" ON referral_codes;
--
-- ALTER TABLE referrals DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "referrals_select_own" ON referrals;
-- DROP POLICY IF EXISTS "referrals_insert_own" ON referrals;
-- DROP POLICY IF EXISTS "referrals_update_referrer" ON referrals;
-- ============================================================================
