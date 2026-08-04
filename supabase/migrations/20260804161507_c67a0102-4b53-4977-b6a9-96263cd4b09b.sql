CREATE TABLE IF NOT EXISTS public.search_reco_cache (
  query_key text PRIMARY KEY,
  query text NOT NULL,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.search_reco_cache TO service_role;
ALTER TABLE public.search_reco_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_reco_cache_service_only" ON public.search_reco_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS search_reco_cache_created_idx ON public.search_reco_cache (created_at DESC);