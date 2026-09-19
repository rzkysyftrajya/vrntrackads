ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_page_views" ON public.page_views;
CREATE POLICY "select_own_page_views" ON public.page_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.page_views REPLICA IDENTITY FULL;
