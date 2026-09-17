/*
# Create ad_campaign_metrics table

Table for storing synced Google Ads campaign performance metrics.
*/

CREATE TABLE IF NOT EXISTS public.ad_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  cost numeric(14, 4) NOT NULL DEFAULT 0.0000,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint required for onConflict: 'campaign_id,date'
  CONSTRAINT uq_ad_campaign_metrics_campaign_date UNIQUE (campaign_id, date)
);

ALTER TABLE public.ad_campaign_metrics
  ADD COLUMN IF NOT EXISTS cost_micros bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Enable RLS
ALTER TABLE public.ad_campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view campaign metrics
DROP POLICY IF EXISTS "allow_read_ad_campaign_metrics" ON public.ad_campaign_metrics;
CREATE POLICY "allow_read_ad_campaign_metrics" ON public.ad_campaign_metrics
  FOR SELECT TO authenticated USING (true);

-- Indexes for optimal querying by date and campaign
CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_date ON public.ad_campaign_metrics (date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_campaign ON public.ad_campaign_metrics (campaign_id);

-- Drop and recreate the view to avoid conflicts when the migration is re-run.
DROP VIEW IF EXISTS public.v_campaign_performance;

CREATE VIEW public.v_campaign_performance AS
SELECT
  m.campaign_id,
  m.campaign_name,
  m.date,
  m.impressions,
  m.clicks,
  m.cost,
  m.cost_micros,
  CASE
    WHEN m.impressions > 0 THEN ROUND((m.clicks::numeric / m.impressions::numeric) * 100, 2)
    ELSE 0
  END AS ctr,
  CASE
    WHEN m.clicks > 0 THEN ROUND((m.cost::numeric / m.clicks::numeric), 2)
    ELSE 0
  END AS cpc
FROM public.ad_campaign_metrics m;

