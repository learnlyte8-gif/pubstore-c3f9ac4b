-- ============ PRODUCT-LEVEL PROMOTION SETTINGS ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promote_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS commission_value numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_release_days int NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS min_promoter_level int NOT NULL DEFAULT 1;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_commission_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_commission_type_check
  CHECK (commission_type IN ('percent','fixed'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_commission_value_check;
ALTER TABLE public.products ADD CONSTRAINT products_commission_value_check
  CHECK (commission_value >= 0);

CREATE INDEX IF NOT EXISTS idx_products_promote ON public.products(promote_enabled) WHERE promote_enabled;

-- Commission for one unit of a product, in USD.
CREATE OR REPLACE FUNCTION public.product_commission_per_unit(_unit_price numeric, _type text, _value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(0, LEAST(
    COALESCE(_unit_price, 0),
    CASE WHEN _type = 'fixed' THEN COALESCE(_value, 0)
         ELSE round(COALESCE(_unit_price, 0) * COALESCE(_value, 0) / 100.0, 2) END
  ))
$$;

-- ============ SHORT CODES ============
CREATE OR REPLACE FUNCTION public.gen_short_code(_len int DEFAULT 5)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
BEGIN
  FOR i IN 1.._len LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out;
END;
$$;

-- ============ PROMOTER PROFILES ============
CREATE TABLE IF NOT EXISTS public.promoter_profiles (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  level int NOT NULL DEFAULT 1,
  risk_score int NOT NULL DEFAULT 0,
  risk_band text NOT NULL DEFAULT 'low',
  frozen boolean NOT NULL DEFAULT false,
  frozen_reason text,
  accepted_terms_at timestamptz,
  public_leaderboard boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promoter_profiles_risk_band_check CHECK (risk_band IN ('low','medium','high'))
);
GRANT SELECT, INSERT, UPDATE ON public.promoter_profiles TO authenticated;
GRANT ALL ON public.promoter_profiles TO service_role;
ALTER TABLE public.promoter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own promoter profile read" ON public.promoter_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own promoter profile insert" ON public.promoter_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own promoter profile update" ON public.promoter_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promoter_profiles_updated BEFORE UPDATE ON public.promoter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROMOTIONS + LINKS ============
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_promoter ON public.promotions(promoter_id);
GRANT SELECT, INSERT, UPDATE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own promotions" ON public.promotions FOR ALL TO authenticated
  USING (auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = promoter_id);
CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.promotion_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  promoter_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'link',
  campaign text,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotion_links_promoter ON public.promotion_links(promoter_id);
CREATE INDEX IF NOT EXISTS idx_promotion_links_product ON public.promotion_links(product_id);
GRANT SELECT, INSERT, UPDATE ON public.promotion_links TO authenticated;
GRANT ALL ON public.promotion_links TO service_role;
ALTER TABLE public.promotion_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own promotion links" ON public.promotion_links FOR ALL TO authenticated
  USING (auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = promoter_id);
CREATE TRIGGER trg_promotion_links_updated BEFORE UPDATE ON public.promotion_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CLICKS ============
CREATE TABLE IF NOT EXISTS public.promotion_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.promotion_links(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  promoter_id uuid NOT NULL,
  product_id uuid,
  visitor_id text,
  user_id uuid,
  source text,
  medium text,
  campaign text,
  landing_page text,
  ip_hash text,
  user_agent text,
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotion_clicks_promoter ON public.promotion_clicks(promoter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_clicks_link ON public.promotion_clicks(link_id);
GRANT SELECT ON public.promotion_clicks TO authenticated;
GRANT ALL ON public.promotion_clicks TO service_role;
ALTER TABLE public.promotion_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own clicks read" ON public.promotion_clicks FOR SELECT TO authenticated
  USING (auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'));

-- ============ ATTRIBUTION ============
CREATE TABLE IF NOT EXISTS public.promotion_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text,
  user_id uuid,
  promoter_id uuid NOT NULL,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.promotion_links(id) ON DELETE SET NULL,
  product_id uuid,
  campaign text,
  source text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attr_visitor ON public.promotion_attributions(visitor_id) WHERE visitor_id IS NOT NULL AND user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attr_user ON public.promotion_attributions(user_id) WHERE user_id IS NOT NULL;
GRANT SELECT ON public.promotion_attributions TO authenticated;
GRANT ALL ON public.promotion_attributions TO service_role;
ALTER TABLE public.promotion_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own attribution read" ON public.promotion_attributions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promotion_attributions_updated BEFORE UPDATE ON public.promotion_attributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ COMMISSION LEDGER ============
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code text UNIQUE DEFAULT ('COM-' || lpad((floor(random()*999999))::text, 6, '0')),
  promoter_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid,
  supplier_id uuid,
  promotion_id uuid REFERENCES public.promotions(id) ON DELETE SET NULL,
  link_id uuid REFERENCES public.promotion_links(id) ON DELETE SET NULL,
  campaign text,
  commission_type text NOT NULL DEFAULT 'percent',
  commission_rate numeric(12,4) NOT NULL DEFAULT 0,
  commission_base numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(14,6) NOT NULL DEFAULT 1,
  release_days int NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  available_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT commissions_status_check CHECK (status IN ('pending','confirmed','available','paid','cancelled','reversed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_item_promoter
  ON public.commissions(order_item_id, promoter_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_promoter ON public.commissions(promoter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_order ON public.commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_supplier ON public.commissions(supplier_id);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promoter or seller or admin reads commissions" ON public.commissions FOR SELECT TO authenticated
  USING (
    auth.uid() = promoter_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid REFERENCES public.commissions(id) ON DELETE CASCADE,
  promoter_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  kind text NOT NULL DEFAULT 'adjustment',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_promoter ON public.commission_adjustments(promoter_id, created_at DESC);
GRANT SELECT ON public.commission_adjustments TO authenticated;
GRANT ALL ON public.commission_adjustments TO service_role;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own adjustments read" ON public.commission_adjustments FOR SELECT TO authenticated
  USING (auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.promoter_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'wallet',
  status text NOT NULL DEFAULT 'completed',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promoter_payouts_status_check CHECK (status IN ('requested','processing','completed','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_promoter_payouts_promoter ON public.promoter_payouts(promoter_id, created_at DESC);
GRANT SELECT ON public.promoter_payouts TO authenticated;
GRANT ALL ON public.promoter_payouts TO service_role;
ALTER TABLE public.promoter_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payouts read" ON public.promoter_payouts FOR SELECT TO authenticated
  USING (auth.uid() = promoter_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_promoter_payouts_updated BEFORE UPDATE ON public.promoter_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.promoter_fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promoter_fraud_events_severity_check CHECK (severity IN ('low','medium','high'))
);
CREATE INDEX IF NOT EXISTS idx_fraud_events_promoter ON public.promoter_fraud_events(promoter_id, created_at DESC);
GRANT SELECT ON public.promoter_fraud_events TO authenticated;
GRANT ALL ON public.promoter_fraud_events TO service_role;
ALTER TABLE public.promoter_fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads fraud events" ON public.promoter_fraud_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  commission_id uuid,
  promoter_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_audit_log TO authenticated;
GRANT ALL ON public.commission_audit_log TO service_role;
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads commission audit" ON public.commission_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ PROMOTER SELF-SERVICE FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.promoter_ensure_profile()
RETURNS public.promoter_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.promoter_profiles;
  attempt int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO p FROM public.promoter_profiles WHERE user_id = uid;
  IF p.user_id IS NOT NULL THEN RETURN p; END IF;

  LOOP
    attempt := attempt + 1;
    BEGIN
      INSERT INTO public.promoter_profiles (user_id, code)
      VALUES (uid, 'PUB-' || public.gen_short_code(6))
      RETURNING * INTO p;
      RETURN p;
    EXCEPTION WHEN unique_violation THEN
      IF attempt > 5 THEN RAISE; END IF;
      SELECT * INTO p FROM public.promoter_profiles WHERE user_id = uid;
      IF p.user_id IS NOT NULL THEN RETURN p; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.promoter_ensure_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.promoter_ensure_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_get_link(_product_id uuid, _channel text DEFAULT 'link', _campaign text DEFAULT NULL)
RETURNS public.promotion_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.promoter_profiles;
  prod public.products;
  promo public.promotions;
  lnk public.promotion_links;
  attempt int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  prof := public.promoter_ensure_profile();
  IF prof.frozen THEN RAISE EXCEPTION 'your promoter account is on hold'; END IF;

  SELECT * INTO prod FROM public.products WHERE id = _product_id;
  IF prod.id IS NULL THEN RAISE EXCEPTION 'product not found'; END IF;
  IF NOT prod.promote_enabled THEN RAISE EXCEPTION 'this product is not available to promote'; END IF;
  IF prof.level < prod.min_promoter_level THEN RAISE EXCEPTION 'your promoter level cannot promote this product yet'; END IF;

  SELECT * INTO promo FROM public.promotions
   WHERE promoter_id = uid AND product_id = _product_id
     AND COALESCE(campaign,'') = COALESCE(_campaign,'')
   LIMIT 1;
  IF promo.id IS NULL THEN
    INSERT INTO public.promotions (promoter_id, product_id, campaign)
    VALUES (uid, _product_id, _campaign) RETURNING * INTO promo;
  END IF;

  SELECT * INTO lnk FROM public.promotion_links
   WHERE promotion_id = promo.id AND channel = COALESCE(_channel,'link') LIMIT 1;
  IF lnk.id IS NOT NULL THEN RETURN lnk; END IF;

  LOOP
    attempt := attempt + 1;
    BEGIN
      INSERT INTO public.promotion_links (promotion_id, promoter_id, product_id, code, channel, campaign)
      VALUES (promo.id, uid, _product_id, public.gen_short_code(6), COALESCE(_channel,'link'), _campaign)
      RETURNING * INTO lnk;
      RETURN lnk;
    EXCEPTION WHEN unique_violation THEN
      IF attempt > 6 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_get_link(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.promote_get_link(uuid, text, text) TO authenticated;

-- Click tracking: callable by anonymous visitors.
CREATE OR REPLACE FUNCTION public.track_promotion_click(
  _code text,
  _visitor_id text DEFAULT NULL,
  _source text DEFAULT NULL,
  _landing_page text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lnk public.promotion_links;
  prof public.promoter_profiles;
  uid uuid := auth.uid();
  bot boolean := COALESCE(_user_agent,'') ~* '(bot|crawler|spider|preview|facebookexternalhit|whatsapp)';
  win interval := interval '7 days';
BEGIN
  SELECT * INTO lnk FROM public.promotion_links WHERE code = _code;
  IF lnk.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO prof FROM public.promoter_profiles WHERE user_id = lnk.promoter_id;

  INSERT INTO public.promotion_clicks
    (link_id, promotion_id, promoter_id, product_id, visitor_id, user_id, source, campaign, landing_page, user_agent, is_bot)
  VALUES (lnk.id, lnk.promotion_id, lnk.promoter_id, lnk.product_id, _visitor_id, uid,
          _source, lnk.campaign, _landing_page, left(COALESCE(_user_agent,''), 400), bot);

  IF NOT bot THEN
    UPDATE public.promotion_links SET clicks = clicks + 1 WHERE id = lnk.id;

    IF NOT COALESCE(prof.frozen, false) AND (uid IS NULL OR uid <> lnk.promoter_id) THEN
      IF uid IS NOT NULL THEN
        INSERT INTO public.promotion_attributions
          (user_id, visitor_id, promoter_id, promotion_id, link_id, product_id, campaign, source, expires_at)
        VALUES (uid, _visitor_id, lnk.promoter_id, lnk.promotion_id, lnk.id, lnk.product_id, lnk.campaign, _source, now() + win)
        ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE
          SET promoter_id = EXCLUDED.promoter_id, promotion_id = EXCLUDED.promotion_id,
              link_id = EXCLUDED.link_id, product_id = EXCLUDED.product_id,
              campaign = EXCLUDED.campaign, source = EXCLUDED.source,
              visitor_id = COALESCE(EXCLUDED.visitor_id, public.promotion_attributions.visitor_id),
              expires_at = EXCLUDED.expires_at, updated_at = now();
      ELSIF _visitor_id IS NOT NULL THEN
        INSERT INTO public.promotion_attributions
          (visitor_id, promoter_id, promotion_id, link_id, product_id, campaign, source, expires_at)
        VALUES (_visitor_id, lnk.promoter_id, lnk.promotion_id, lnk.id, lnk.product_id, lnk.campaign, _source, now() + win)
        ON CONFLICT (visitor_id) WHERE visitor_id IS NOT NULL AND user_id IS NULL DO UPDATE
          SET promoter_id = EXCLUDED.promoter_id, promotion_id = EXCLUDED.promotion_id,
              link_id = EXCLUDED.link_id, product_id = EXCLUDED.product_id,
              campaign = EXCLUDED.campaign, source = EXCLUDED.source,
              expires_at = EXCLUDED.expires_at, updated_at = now();
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('found', true, 'product_id', lnk.product_id, 'code', lnk.code);
END;
$$;
REVOKE ALL ON FUNCTION public.track_promotion_click(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_promotion_click(text, text, text, text, text) TO anon, authenticated;

-- Attach an anonymous visitor's attribution to the signed-in account.
CREATE OR REPLACE FUNCTION public.promote_claim_attribution(_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  a public.promotion_attributions;
BEGIN
  IF uid IS NULL OR _visitor_id IS NULL THEN RETURN; END IF;
  SELECT * INTO a FROM public.promotion_attributions
    WHERE visitor_id = _visitor_id AND user_id IS NULL AND expires_at > now()
    ORDER BY updated_at DESC LIMIT 1;
  IF a.id IS NULL OR a.promoter_id = uid THEN RETURN; END IF;

  INSERT INTO public.promotion_attributions
    (user_id, visitor_id, promoter_id, promotion_id, link_id, product_id, campaign, source, expires_at)
  VALUES (uid, _visitor_id, a.promoter_id, a.promotion_id, a.link_id, a.product_id, a.campaign, a.source, a.expires_at)
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO UPDATE
    SET promoter_id = EXCLUDED.promoter_id, promotion_id = EXCLUDED.promotion_id,
        link_id = EXCLUDED.link_id, product_id = EXCLUDED.product_id,
        campaign = EXCLUDED.campaign, source = EXCLUDED.source,
        expires_at = GREATEST(public.promotion_attributions.expires_at, EXCLUDED.expires_at),
        updated_at = now();

  DELETE FROM public.promotion_attributions WHERE id = a.id;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_claim_attribution(text) FROM public;
GRANT EXECUTE ON FUNCTION public.promote_claim_attribution(text) TO authenticated;

-- ============ COMMISSION ENGINE ============
CREATE OR REPLACE FUNCTION public._create_promo_commissions(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  a public.promotion_attributions;
  prof public.promoter_profiles;
  it record;
  base numeric;
  per_unit numeric;
  amt numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RETURN; END IF;

  SELECT * INTO a FROM public.promotion_attributions
    WHERE user_id = o.buyer_id AND expires_at > o.created_at
    ORDER BY updated_at DESC LIMIT 1;
  IF a.id IS NULL THEN RETURN; END IF;

  IF a.promoter_id = o.buyer_id THEN
    INSERT INTO public.promoter_fraud_events (promoter_id, kind, severity, detail, order_id)
    VALUES (a.promoter_id, 'self_purchase', 'medium', jsonb_build_object('order_id', o.id), o.id);
    RETURN;
  END IF;

  SELECT * INTO prof FROM public.promoter_profiles WHERE user_id = a.promoter_id;
  IF COALESCE(prof.frozen, false) THEN RETURN; END IF;

  FOR it IN
    SELECT oi.id, oi.product_id, oi.qty, oi.unit_price,
           p.promote_enabled, p.commission_type, p.commission_value, p.commission_release_days, p.supplier_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = o.id
  LOOP
    CONTINUE WHEN NOT it.promote_enabled;
    CONTINUE WHEN a.product_id IS NOT NULL AND a.product_id <> it.product_id;

    per_unit := public.product_commission_per_unit(it.unit_price, it.commission_type, it.commission_value);
    CONTINUE WHEN per_unit <= 0;
    base := round(COALESCE(it.unit_price, 0) * COALESCE(it.qty, 1), 2);
    amt := round(per_unit * COALESCE(it.qty, 1), 2);

    INSERT INTO public.commissions (
      promoter_id, order_id, order_item_id, product_id, supplier_id,
      promotion_id, link_id, campaign,
      commission_type, commission_rate, commission_base, commission_amount,
      release_days, status
    ) VALUES (
      a.promoter_id, o.id, it.id, it.product_id, it.supplier_id,
      a.promotion_id, a.link_id, a.campaign,
      it.commission_type, it.commission_value, base, amt,
      COALESCE(it.commission_release_days, 7), 'pending'
    )
    ON CONFLICT (order_item_id, promoter_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT c.promoter_id, 'promoter_sale', 'You made a sale!',
         'Your commission of $' || to_char(SUM(c.commission_amount), 'FM999990.00')
           || ' has been added to your pending earnings.', '/promote/earnings'
    FROM public.commissions c
   WHERE c.order_id = o.id AND c.status = 'pending'
   GROUP BY c.promoter_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._promo_commissions_on_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Paid: create pending commissions.
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.escrow_status,'none') IN ('held','released'))
     OR (TG_OP = 'UPDATE' AND COALESCE(NEW.escrow_status,'none') IN ('held','released')
         AND COALESCE(OLD.escrow_status,'none') NOT IN ('held','released')) THEN
    PERFORM public._create_promo_commissions(NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Delivered / released: confirm and schedule availability.
    IF COALESCE(NEW.escrow_status,'none') = 'released' AND COALESCE(OLD.escrow_status,'none') <> 'released' THEN
      UPDATE public.commissions
         SET status = 'confirmed', confirmed_at = now(),
             available_at = now() + (COALESCE(release_days, 7) || ' days')::interval
       WHERE order_id = NEW.id AND status = 'pending';

      INSERT INTO public.notifications (user_id, type, title, body, link)
      SELECT c.promoter_id, 'promoter_commission', 'Commission confirmed',
             'Commission of $' || to_char(SUM(c.commission_amount), 'FM999990.00')
               || ' is confirmed and will be available soon.', '/promote/earnings'
        FROM public.commissions c
       WHERE c.order_id = NEW.id AND c.status = 'confirmed'
       GROUP BY c.promoter_id;
    END IF;

    -- Cancelled / refunded: cancel or reverse.
    IF (COALESCE(NEW.escrow_status,'none') IN ('refunded','cancelled')
        AND COALESCE(OLD.escrow_status,'none') NOT IN ('refunded','cancelled'))
       OR (NEW.status::text = 'cancelled' AND OLD.status::text <> 'cancelled') THEN
      INSERT INTO public.commission_adjustments (commission_id, promoter_id, amount, reason, kind)
      SELECT c.id, c.promoter_id, -c.commission_amount, 'Order cancelled or refunded', 'reversal'
        FROM public.commissions c
       WHERE c.order_id = NEW.id AND c.status = 'paid';

      UPDATE public.commissions
         SET status = CASE WHEN status = 'paid' THEN 'reversed' ELSE 'cancelled' END,
             cancelled_at = now()
       WHERE order_id = NEW.id AND status IN ('pending','confirmed','available','paid');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_commissions_orders ON public.orders;
CREATE TRIGGER trg_promo_commissions_orders
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._promo_commissions_on_order_event();

-- Release window passed: make confirmed commissions available.
CREATE OR REPLACE FUNCTION public.promote_mature_commissions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  WITH matured AS (
    UPDATE public.commissions
       SET status = 'available'
     WHERE status = 'confirmed' AND available_at IS NOT NULL AND available_at <= now()
    RETURNING promoter_id, commission_amount
  ), grouped AS (
    SELECT promoter_id, SUM(commission_amount) AS total, COUNT(*) AS cnt FROM matured GROUP BY promoter_id
  )
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT promoter_id, 'promoter_commission', 'Earnings available',
         '$' || to_char(total, 'FM999990.00') || ' is now available for withdrawal.', '/promote/earnings'
    FROM grouped;
  SELECT COUNT(*) INTO n FROM public.commissions WHERE status = 'available';
  RETURN n;
END;
$$;

-- ============ EARNINGS SUMMARY (ledger-derived) ============
CREATE OR REPLACE VIEW public.promoter_earnings_summary
WITH (security_invoker = true) AS
SELECT
  c.promoter_id,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status IN ('confirmed','available','paid')), 0)
    + COALESCE((SELECT SUM(a.amount) FROM public.commission_adjustments a WHERE a.promoter_id = c.promoter_id), 0) AS total_earned,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'pending'), 0) AS pending_amount,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'confirmed'), 0) AS confirming_amount,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'available'), 0) AS available_amount,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'paid'), 0) AS paid_amount,
  COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status IN ('cancelled','reversed')), 0) AS reversed_amount,
  COUNT(*) FILTER (WHERE c.status NOT IN ('cancelled','reversed')) AS sales_count,
  COALESCE(SUM(c.commission_base) FILTER (WHERE c.status NOT IN ('cancelled','reversed')), 0) AS sales_revenue
FROM public.commissions c
GROUP BY c.promoter_id;
GRANT SELECT ON public.promoter_earnings_summary TO authenticated;

-- ============ WITHDRAWAL TO WALLET ============
CREATE OR REPLACE FUNCTION public.promoter_withdraw_earnings(_amount numeric)
RETURNS public.promoter_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.promoter_profiles;
  avail numeric;
  remaining numeric;
  c record;
  po public.promoter_payouts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO prof FROM public.promoter_profiles WHERE user_id = uid FOR UPDATE;
  IF prof.user_id IS NULL THEN RAISE EXCEPTION 'no promoter account'; END IF;
  IF prof.frozen THEN RAISE EXCEPTION 'withdrawals are on hold for your account'; END IF;
  IF prof.level < 2 THEN RAISE EXCEPTION 'verify your account to withdraw earnings'; END IF;
  IF _amount IS NULL OR _amount < 10 THEN RAISE EXCEPTION 'minimum withdrawal is $10'; END IF;

  SELECT COALESCE(SUM(commission_amount), 0) INTO avail
    FROM public.commissions WHERE promoter_id = uid AND status = 'available';
  IF _amount > avail THEN RAISE EXCEPTION 'you only have $% available', to_char(avail, 'FM999990.00'); END IF;

  INSERT INTO public.promoter_payouts (promoter_id, amount, method, status)
  VALUES (uid, round(_amount, 2), 'wallet', 'completed') RETURNING * INTO po;

  remaining := round(_amount, 2);
  FOR c IN
    SELECT id, commission_amount FROM public.commissions
     WHERE promoter_id = uid AND status = 'available'
     ORDER BY available_at NULLS LAST, created_at
  LOOP
    EXIT WHEN remaining <= 0;
    IF c.commission_amount <= remaining THEN
      UPDATE public.commissions SET status = 'paid', paid_at = now(), note = po.id::text WHERE id = c.id;
      remaining := remaining - c.commission_amount;
    ELSE
      -- Partially draw down a larger commission by splitting it.
      UPDATE public.commissions SET commission_amount = commission_amount - remaining WHERE id = c.id;
      INSERT INTO public.commissions (
        promoter_id, order_id, order_item_id, product_id, supplier_id, promotion_id, link_id, campaign,
        commission_type, commission_rate, commission_base, commission_amount, release_days,
        status, paid_at, note
      )
      SELECT promoter_id, order_id, NULL, product_id, supplier_id, promotion_id, link_id, campaign,
             commission_type, commission_rate, 0, remaining, release_days, 'paid', now(), po.id::text
        FROM public.commissions WHERE id = c.id;
      remaining := 0;
    END IF;
  END LOOP;

  PERFORM public.apply_wallet_transaction(
    uid, 'commission', round(_amount, 2),
    'Promoter earnings payout', 'promoter_payout:' || po.id::text, 'personal');

  UPDATE public.promoter_payouts SET reference = 'promoter_payout:' || po.id::text WHERE id = po.id RETURNING * INTO po;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'promoter_commission', 'Earnings paid out',
    '$' || to_char(_amount, 'FM999990.00') || ' was added to your wallet.', '/wallet');

  RETURN po;
END;
$$;
REVOKE ALL ON FUNCTION public.promoter_withdraw_earnings(numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.promoter_withdraw_earnings(numeric) TO authenticated;

-- Allow the 'commission' wallet transaction kind.
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_kind_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_kind_check
  CHECK (kind = ANY (ARRAY[
    'topup','purchase','refund','adjustment',
    'transfer_in','transfer_out','withdrawal_hold','payout',
    'sale','sales_to_personal_out','sales_to_personal_in','commission'
  ]));

-- ============ ADMIN CONTROLS ============
CREATE OR REPLACE FUNCTION public.admin_set_commission_status(_commission_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS public.commissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  before_row public.commissions;
  after_row public.commissions;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _status NOT IN ('pending','confirmed','available','paid','cancelled','reversed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  SELECT * INTO before_row FROM public.commissions WHERE id = _commission_id FOR UPDATE;
  IF before_row.id IS NULL THEN RAISE EXCEPTION 'commission not found'; END IF;

  IF before_row.status = 'paid' AND _status IN ('cancelled','reversed') THEN
    INSERT INTO public.commission_adjustments (commission_id, promoter_id, amount, reason, kind, created_by)
    VALUES (before_row.id, before_row.promoter_id, -before_row.commission_amount, _reason, 'reversal', uid);
  END IF;

  UPDATE public.commissions
     SET status = _status,
         cancelled_at = CASE WHEN _status IN ('cancelled','reversed') THEN now() ELSE cancelled_at END,
         available_at = CASE WHEN _status = 'available' THEN COALESCE(available_at, now()) ELSE available_at END,
         note = COALESCE(_reason, note)
   WHERE id = _commission_id RETURNING * INTO after_row;

  INSERT INTO public.commission_audit_log (actor_id, action, commission_id, promoter_id, before, after, reason)
  VALUES (uid, 'commission_status_change', _commission_id, before_row.promoter_id,
          to_jsonb(before_row), to_jsonb(after_row), _reason);

  RETURN after_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_commission_status(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_commission_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_promoter_hold(_promoter_id uuid, _frozen boolean, _reason text DEFAULT NULL)
RETURNS public.promoter_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.promoter_profiles;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.promoter_profiles
     SET frozen = _frozen, frozen_reason = _reason
   WHERE user_id = _promoter_id RETURNING * INTO p;
  IF p.user_id IS NULL THEN RAISE EXCEPTION 'promoter not found'; END IF;

  INSERT INTO public.commission_audit_log (actor_id, action, promoter_id, after, reason)
  VALUES (uid, CASE WHEN _frozen THEN 'promoter_frozen' ELSE 'promoter_unfrozen' END, _promoter_id, to_jsonb(p), _reason);
  RETURN p;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_promoter_hold(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_promoter_hold(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_promote_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_build_object(
    'promoters', (SELECT COUNT(*) FROM public.promoter_profiles),
    'active_promoters', (SELECT COUNT(DISTINCT promoter_id) FROM public.promotion_links WHERE clicks > 0),
    'frozen_promoters', (SELECT COUNT(*) FROM public.promoter_profiles WHERE frozen),
    'clicks', (SELECT COUNT(*) FROM public.promotion_clicks WHERE NOT is_bot),
    'attributed_orders', (SELECT COUNT(DISTINCT order_id) FROM public.commissions),
    'commission_pending', (SELECT COALESCE(SUM(commission_amount),0) FROM public.commissions WHERE status = 'pending'),
    'commission_confirmed', (SELECT COALESCE(SUM(commission_amount),0) FROM public.commissions WHERE status = 'confirmed'),
    'commission_available', (SELECT COALESCE(SUM(commission_amount),0) FROM public.commissions WHERE status = 'available'),
    'commission_paid', (SELECT COALESCE(SUM(commission_amount),0) FROM public.commissions WHERE status = 'paid'),
    'commission_reversed', (SELECT COALESCE(SUM(commission_amount),0) FROM public.commissions WHERE status IN ('cancelled','reversed')),
    'promoter_gmv', (SELECT COALESCE(SUM(commission_base),0) FROM public.commissions WHERE status NOT IN ('cancelled','reversed')),
    'total_gmv', (SELECT COALESCE(SUM(total),0) FROM public.orders),
    'fraud_open', (SELECT COUNT(*) FROM public.promoter_fraud_events WHERE NOT resolved)
  ) INTO res;
  RETURN res;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_promote_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_promote_overview() TO authenticated;

-- Nightly maturation job.
SELECT cron.unschedule('promote-mature-commissions')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'promote-mature-commissions');
SELECT cron.schedule('promote-mature-commissions', '17 * * * *', $$SELECT public.promote_mature_commissions();$$);