CREATE TABLE IF NOT EXISTS public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Website',
  domain text,
  tracking_key text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  apps_script_url text,
  forwarding_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_websites" ON public.websites;
CREATE POLICY "select_own_websites" ON public.websites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_websites" ON public.websites;
CREATE POLICY "insert_own_websites" ON public.websites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_websites" ON public.websites;
CREATE POLICY "update_own_websites" ON public.websites
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_websites" ON public.websites;
CREATE POLICY "delete_own_websites" ON public.websites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_websites_user_id ON public.websites (user_id);
CREATE INDEX IF NOT EXISTS idx_websites_tracking_key ON public.websites (tracking_key);
CREATE INDEX IF NOT EXISTS idx_websites_created_at ON public.websites (created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clicks' AND column_name = 'website_id') THEN
    NULL;
  ELSE
    ALTER TABLE public.clicks ADD COLUMN website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'impressions' AND column_name = 'website_id') THEN
    NULL;
  ELSE
    ALTER TABLE public.impressions ADD COLUMN website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_views' AND column_name = 'website_id') THEN
    NULL;
  ELSE
    ALTER TABLE public.page_views ADD COLUMN website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clicks_website_id ON public.clicks (website_id);
CREATE INDEX IF NOT EXISTS idx_impressions_website_id ON public.impressions (website_id);
CREATE INDEX IF NOT EXISTS idx_page_views_website_id ON public.page_views (website_id);
