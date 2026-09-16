/*
# VRN TRACK ADS — Core Schema

## Purpose
Ad tracking platform that captures impressions and clicks from third-party
landing pages via a tracking SDK, stores them per-user, and optionally forwards
each event to a user-configured Google Apps Script URL.

## New Tables

### profiles
- id (uuid, PK), user_id (FK auth.users), display_name, apps_script_url,
  tracking_key (uuid unique), forwarding_active (bool default true), created_at

### impressions
- id, user_id, tracking_key, landing_page, referrer, country, city, device,
  browser, ip_address, created_at

### clicks
- id, user_id, tracking_key, gclid, utm_source, utm_medium, utm_campaign,
  keyword, device, ip_address, country, city, landing_page, created_at

## Security
- RLS on all tables. Owner-scoped CRUD via auth.uid() = user_id.
- Edge function writes with service role key (bypasses RLS).

## Notes
1. tracking_key defaults to gen_random_uuid().
2. user_id defaults to auth.uid() so client inserts satisfy WITH CHECK.
3. Indexes on tracking_key, user_id, created_at.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  apps_script_url text,
  tracking_key uuid UNIQUE DEFAULT gen_random_uuid(),
  forwarding_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profiles" ON profiles;
CREATE POLICY "select_own_profiles" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profiles" ON profiles;
CREATE POLICY "insert_own_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profiles" ON profiles;
CREATE POLICY "update_own_profiles" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profiles" ON profiles;
CREATE POLICY "delete_own_profiles" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tracking_key text,
  landing_page text,
  referrer text,
  country text,
  city text,
  device text,
  browser text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_impressions" ON impressions;
CREATE POLICY "select_own_impressions" ON impressions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_impressions" ON impressions;
CREATE POLICY "insert_own_impressions" ON impressions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_impressions" ON impressions;
CREATE POLICY "update_own_impressions" ON impressions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_impressions" ON impressions;
CREATE POLICY "delete_own_impressions" ON impressions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_impressions_user_id ON impressions (user_id);
CREATE INDEX IF NOT EXISTS idx_impressions_tracking_key ON impressions (tracking_key);
CREATE INDEX IF NOT EXISTS idx_impressions_created_at ON impressions (created_at DESC);

CREATE TABLE IF NOT EXISTS clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tracking_key text,
  gclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  keyword text,
  device text,
  ip_address text,
  country text,
  city text,
  landing_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_clicks" ON clicks;
CREATE POLICY "select_own_clicks" ON clicks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_clicks" ON clicks;
CREATE POLICY "insert_own_clicks" ON clicks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_clicks" ON clicks;
CREATE POLICY "update_own_clicks" ON clicks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_clicks" ON clicks;
CREATE POLICY "delete_own_clicks" ON clicks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clicks_user_id ON clicks (user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_tracking_key ON clicks (tracking_key);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks (created_at DESC);
