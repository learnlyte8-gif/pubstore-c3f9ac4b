
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_id text;

ALTER TABLE public.stays
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE INDEX IF NOT EXISTS products_source_id_idx ON public.products (source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stays_source_id_idx ON public.stays (source, source_id) WHERE source_id IS NOT NULL;
