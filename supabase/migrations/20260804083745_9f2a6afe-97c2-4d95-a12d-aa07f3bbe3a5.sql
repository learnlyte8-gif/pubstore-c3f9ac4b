CREATE TABLE public.learnlyte_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  result jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.learnlyte_ai_cache TO service_role;

ALTER TABLE public.learnlyte_ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages ai cache" ON public.learnlyte_ai_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX learnlyte_ai_cache_kind_idx ON public.learnlyte_ai_cache (kind);