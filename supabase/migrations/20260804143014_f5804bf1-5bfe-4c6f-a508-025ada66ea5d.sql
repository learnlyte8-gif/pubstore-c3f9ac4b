
ALTER TABLE public.supplier_plans
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.supplier_plans SET features = '["basic_analytics"]'::jsonb WHERE code = 'free';
UPDATE public.supplier_plans SET features = '["basic_analytics","full_analytics","bulk_import","live_selling","ads","coupons","priority_placement"]'::jsonb WHERE code = 'pro';
UPDATE public.supplier_plans SET features = '["basic_analytics","full_analytics","bulk_import","live_selling","ads","coupons","priority_placement","featured_badge","priority_support","top_placement"]'::jsonb WHERE code = 'elite';

CREATE OR REPLACE FUNCTION public.supplier_has_feature(_supplier_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.features ? _feature
     FROM public.supplier_plans p
     WHERE p.code = COALESCE(
       (SELECT s.plan_code FROM public.supplier_subscriptions s
        WHERE s.supplier_id = _supplier_id
          AND (s.renews_at IS NULL OR s.renews_at > now())
        LIMIT 1), 'free')),
    false);
$$;

GRANT EXECUTE ON FUNCTION public.supplier_has_feature(uuid, text) TO authenticated, service_role;

-- Gate live selling
CREATE OR REPLACE FUNCTION public._enforce_supplier_live_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NOT public.supplier_has_feature(NEW.supplier_id, 'live_selling') THEN
    RAISE EXCEPTION 'Live selling requires the Pro or Elite supplier plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_supplier_live_feature ON public.live_streams;
CREATE TRIGGER enforce_supplier_live_feature
BEFORE INSERT ON public.live_streams
FOR EACH ROW EXECUTE FUNCTION public._enforce_supplier_live_feature();

-- Gate ads
CREATE OR REPLACE FUNCTION public._enforce_supplier_ads_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NOT public.supplier_has_feature(NEW.supplier_id, 'ads') THEN
    RAISE EXCEPTION 'Ad campaigns require the Pro or Elite supplier plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_supplier_ads_feature ON public.ad_campaigns;
CREATE TRIGGER enforce_supplier_ads_feature
BEFORE INSERT ON public.ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public._enforce_supplier_ads_feature();

-- Gate coupons
CREATE OR REPLACE FUNCTION public._enforce_supplier_coupons_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NOT public.supplier_has_feature(NEW.supplier_id, 'coupons') THEN
    RAISE EXCEPTION 'Coupons require the Pro or Elite supplier plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_supplier_coupons_feature ON public.coupons;
CREATE TRIGGER enforce_supplier_coupons_feature
BEFORE INSERT ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public._enforce_supplier_coupons_feature();
