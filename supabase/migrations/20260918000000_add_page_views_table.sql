CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tracking_key text NOT NULL,
  session_id text,
  fingerprint text,
  landing_page text,
  page_url text,
  referrer text,
  country text,
  city text,
  ip_address text,
  device text,
  os text,
  browser text,
  user_agent text,
  is_bot boolean NOT NULL DEFAULT false,
  bot_reasons text,
  status text NOT NULL DEFAULT 'OK',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_website_id
  ON public.page_views (website_id);

CREATE INDEX IF NOT EXISTS idx_page_views_tracking_key
  ON public.page_views (tracking_key);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at
  ON public.page_views (created_at DESC);
