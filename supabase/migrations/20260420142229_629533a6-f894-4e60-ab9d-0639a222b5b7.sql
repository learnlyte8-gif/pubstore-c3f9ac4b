-- ============ Coupons ============
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_subtotal NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, code)
);

CREATE INDEX idx_coupons_code ON public.coupons (code);
CREATE INDEX idx_coupons_supplier ON public.coupons (supplier_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active coupons public read"
  ON public.coupons FOR SELECT
  USING (active = true);

CREATE POLICY "Owner manages coupons"
  ON public.coupons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = coupons.supplier_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = coupons.supplier_id AND s.owner_id = auth.uid()));

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Coupon redemptions ============
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions (coupon_id);
CREATE INDEX idx_coupon_redemptions_buyer ON public.coupon_redemptions (buyer_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer reads own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (auth.uid() = buyer_id
    OR EXISTS (
      SELECT 1 FROM public.coupons c
      JOIN public.suppliers s ON s.id = c.supplier_id
      WHERE c.id = coupon_redemptions.coupon_id AND s.owner_id = auth.uid()
    ));

CREATE POLICY "Buyer creates redemption"
  ON public.coupon_redemptions FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Auto-increment uses_count when a redemption is created
CREATE OR REPLACE FUNCTION public.increment_coupon_uses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET uses_count = uses_count + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coupon_uses
  AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_uses();

-- Add discount column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- ============ Auto-recompute product rating on review changes ============
CREATE OR REPLACE FUNCTION public.recompute_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  avg_rating NUMERIC;
  cnt INTEGER;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO avg_rating, cnt
    FROM public.reviews WHERE product_id = pid;
  UPDATE public.products
    SET rating = ROUND(avg_rating::numeric, 2),
        review_count = cnt
    WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recompute_rating_ins
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();

CREATE TRIGGER trg_recompute_rating_upd
  AFTER UPDATE OF rating ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();

CREATE TRIGGER trg_recompute_rating_del
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();