
-- 1. Columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS supplier_tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS buyer_points numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_points numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_updated_at timestamptz;

-- 2. Tier from points helper
CREATE OR REPLACE FUNCTION public.tier_from_points(_pts numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _pts >= 300 THEN 'gold'
    WHEN _pts >= 100 THEN 'silver'
    ELSE 'bronze'
  END
$$;

-- 3. Recompute function
CREATE OR REPLACE FUNCTION public.recompute_user_tier(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean := false;
  v_order_count int := 0;
  v_spent numeric := 0;
  v_followers int := 0;
  v_age_months numeric := 0;

  v_sales_count int := 0;
  v_sales_revenue numeric := 0;
  v_avg_rating numeric := 0;
  v_supplier_followers int := 0;
  v_response_rate numeric := 0;
  v_on_time numeric := 0;

  v_buyer_pts numeric := 0;
  v_supplier_pts numeric := 0;
  v_is_supplier boolean := false;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Verification
  SELECT EXISTS (SELECT 1 FROM public.user_verifications WHERE user_id = _user_id AND status='approved')
    INTO v_verified;

  -- Buyer metrics
  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_order_count, v_spent
    FROM public.orders WHERE buyer_id = _user_id AND status <> 'cancelled';

  SELECT COUNT(*) INTO v_followers
    FROM public.user_follows WHERE followee_id = _user_id;

  SELECT EXTRACT(EPOCH FROM (now() - created_at)) / (60*60*24*30) INTO v_age_months
    FROM public.profiles WHERE user_id = _user_id;
  v_age_months := COALESCE(v_age_months, 0);

  -- Supplier metrics (aggregate across any suppliers they own)
  SELECT EXISTS(SELECT 1 FROM public.suppliers WHERE owner_id = _user_id) INTO v_is_supplier;

  IF v_is_supplier THEN
    SELECT COUNT(*), COALESCE(SUM(o.total),0)
      INTO v_sales_count, v_sales_revenue
      FROM public.orders o
      JOIN public.suppliers s ON s.id = o.supplier_id
      WHERE s.owner_id = _user_id AND o.status <> 'cancelled';

    SELECT COALESCE(AVG(rating),0), COALESCE(AVG(response_rate),0), COALESCE(AVG(on_time_delivery),0)
      INTO v_avg_rating, v_response_rate, v_on_time
      FROM public.suppliers WHERE owner_id = _user_id;

    SELECT COALESCE(SUM(cnt),0) INTO v_supplier_followers FROM (
      SELECT COUNT(*) AS cnt FROM public.followers f
        JOIN public.suppliers s ON s.id = f.supplier_id
        WHERE s.owner_id = _user_id
    ) t;
  END IF;

  -- Buyer score
  v_buyer_pts :=
      (CASE WHEN v_verified THEN 25 ELSE 0 END)
    + LEAST(v_order_count, 100) * 4
    + LEAST(v_spent / 50.0, 150)
    + LEAST(v_followers, 200) * 0.5
    + LEAST(v_age_months, 24) * 2;

  -- Supplier score
  v_supplier_pts := CASE WHEN v_is_supplier THEN
      (CASE WHEN v_verified THEN 30 ELSE 0 END)
    + LEAST(v_sales_count, 200) * 3
    + LEAST(v_sales_revenue / 100.0, 200)
    + COALESCE(v_avg_rating, 0) * 12
    + COALESCE(v_response_rate, 0) * 0.3
    + COALESCE(v_on_time, 0) * 0.3
    + LEAST(v_supplier_followers, 500) * 0.2
  ELSE 0 END;

  -- Ensure profile exists
  INSERT INTO public.profiles (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles SET
    buyer_points    = ROUND(v_buyer_pts::numeric, 1),
    supplier_points = ROUND(v_supplier_pts::numeric, 1),
    buyer_tier      = public.tier_from_points(v_buyer_pts),
    supplier_tier   = public.tier_from_points(v_supplier_pts),
    tier_updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- 4. Public read function (anyone can see tier of any user)
CREATE OR REPLACE FUNCTION public.get_user_tier_info(_user_id uuid)
RETURNS TABLE(
  buyer_tier text,
  supplier_tier text,
  buyer_points numeric,
  supplier_points numeric,
  next_threshold numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.buyer_tier,
    p.supplier_tier,
    p.buyer_points,
    p.supplier_points,
    CASE
      WHEN GREATEST(p.buyer_points, p.supplier_points) >= 300 THEN 300
      WHEN GREATEST(p.buyer_points, p.supplier_points) >= 100 THEN 300
      ELSE 100
    END AS next_threshold
  FROM public.profiles p WHERE p.user_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_user_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tier_info(uuid) TO anon, authenticated, service_role;

-- 5. Trigger functions
CREATE OR REPLACE FUNCTION public._tier_after_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seller_uid uuid;
BEGIN
  PERFORM public.recompute_user_tier(NEW.buyer_id);
  SELECT owner_id INTO seller_uid FROM public.suppliers WHERE id = NEW.supplier_id;
  IF seller_uid IS NOT NULL THEN PERFORM public.recompute_user_tier(seller_uid); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public._tier_after_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_tier(NEW.user_id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public._tier_after_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_tier(COALESCE(NEW.followee_id, OLD.followee_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_tier_after_order ON public.orders;
CREATE TRIGGER trg_tier_after_order
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._tier_after_order();

DROP TRIGGER IF EXISTS trg_tier_after_verification ON public.user_verifications;
CREATE TRIGGER trg_tier_after_verification
  AFTER INSERT OR UPDATE OF status ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public._tier_after_verification();

DROP TRIGGER IF EXISTS trg_tier_after_follow ON public.user_follows;
CREATE TRIGGER trg_tier_after_follow
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public._tier_after_follow();

-- 6. Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles LOOP
    PERFORM public.recompute_user_tier(r.user_id);
  END LOOP;
END $$;
