
-- Add AI ad fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ad_headline text,
  ADD COLUMN IF NOT EXISTS ad_tagline text,
  ADD COLUMN IF NOT EXISTS ad_has_reel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ad_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS products_ad_has_reel_idx
  ON public.products (ad_has_reel, created_at DESC)
  WHERE ad_has_reel = true;

-- Track AI ad usage on the supplier
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS ad_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_pro boolean NOT NULL DEFAULT false;
