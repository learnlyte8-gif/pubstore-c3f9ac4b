
ALTER TABLE public.courier_profiles
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS min_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distance_discounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_notes TEXT;

ALTER TABLE public.supplier_courier_partnerships
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_scp_default_per_supplier
  ON public.supplier_courier_partnerships(supplier_id)
  WHERE is_default = TRUE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_courier_user_id UUID,
  ADD COLUMN IF NOT EXISTS delivery_option_label TEXT;
