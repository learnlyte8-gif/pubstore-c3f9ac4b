ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deal_ends_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_products_deal_ends_at ON public.products(deal_ends_at) WHERE deal_ends_at IS NOT NULL;