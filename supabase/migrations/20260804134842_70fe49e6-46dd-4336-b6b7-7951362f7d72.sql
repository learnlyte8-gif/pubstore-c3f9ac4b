-- 1. Plans catalogue
CREATE TABLE public.supplier_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  price_usd numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.12,
  product_limit integer,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_plans TO anon, authenticated;
GRANT ALL ON public.supplier_plans TO service_role;
ALTER TABLE public.supplier_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public" ON public.supplier_plans FOR SELECT USING (true);

-- 2. Subscriptions
CREATE TABLE public.supplier_subscriptions (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'free' REFERENCES public.supplier_plans(code),
  started_at timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_subscriptions TO authenticated;
GRANT ALL ON public.supplier_subscriptions TO service_role;
ALTER TABLE public.supplier_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own subscription" ON public.supplier_subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));

-- 3. Commission ledger
CREATE TABLE public.supplier_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  seller_id uuid,
  plan_code text,
  gross numeric NOT NULL,
  rate numeric NOT NULL,
  commission numeric NOT NULL,
  net numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_commissions TO authenticated;
GRANT ALL ON public.supplier_commissions TO service_role;
ALTER TABLE public.supplier_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own commissions" ON public.supplier_commissions
  FOR SELECT TO authenticated USING (seller_id = auth.uid());

CREATE INDEX idx_supplier_commissions_supplier ON public.supplier_commissions(supplier_id, created_at DESC);

CREATE TRIGGER update_supplier_plans_updated_at BEFORE UPDATE ON public.supplier_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplier_subscriptions_updated_at BEFORE UPDATE ON public.supplier_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed plans
INSERT INTO public.supplier_plans (code, name, price_usd, commission_rate, product_limit, perks, sort) VALUES
  ('free',  'Free',  0,  0.12, 20,   '["Up to 20 products","Standard search placement","Basic analytics"]'::jsonb, 1),
  ('pro',   'Pro',   19, 0.07, 500,  '["Up to 500 products","7% commission","Priority search placement","Full analytics","Live selling"]'::jsonb, 2),
  ('elite', 'Elite', 49, 0.04, NULL, '["Unlimited products","Lowest 4% commission","Top search placement","Featured store badge","Priority support","Ads credit boost"]'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;

-- 5. Effective plan resolver (falls back to free when lapsed)
CREATE OR REPLACE FUNCTION public.supplier_effective_plan(_supplier_id uuid)
RETURNS public.supplier_plans
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sub public.supplier_subscriptions; pl public.supplier_plans;
BEGIN
  SELECT * INTO sub FROM public.supplier_subscriptions WHERE supplier_id = _supplier_id;
  IF sub.supplier_id IS NOT NULL
     AND (sub.renews_at IS NULL OR sub.renews_at > now()) THEN
    SELECT * INTO pl FROM public.supplier_plans WHERE code = sub.plan_code;
  END IF;
  IF pl.code IS NULL THEN
    SELECT * INTO pl FROM public.supplier_plans WHERE code = 'free';
  END IF;
  RETURN pl;
END; $$;
GRANT EXECUTE ON FUNCTION public.supplier_effective_plan(uuid) TO authenticated, service_role;

-- 6. Subscribe / change plan (wallet-funded)
CREATE OR REPLACE FUNCTION public.supplier_subscribe_plan(_plan_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sup public.suppliers; pl public.supplier_plans; sub public.supplier_subscriptions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO sup FROM public.suppliers WHERE owner_id = uid ORDER BY created_at LIMIT 1;
  IF sup.id IS NULL THEN RAISE EXCEPTION 'you do not have a store'; END IF;
  SELECT * INTO pl FROM public.supplier_plans WHERE code = _plan_code AND is_active;
  IF pl.code IS NULL THEN RAISE EXCEPTION 'unknown plan'; END IF;

  SELECT * INTO sub FROM public.supplier_subscriptions WHERE supplier_id = sup.id;
  IF sub.supplier_id IS NOT NULL AND sub.plan_code = pl.code
     AND (pl.price_usd = 0 OR (sub.renews_at IS NOT NULL AND sub.renews_at > now())) THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'plan', pl.code);
  END IF;

  IF pl.price_usd > 0 THEN
    PERFORM public.apply_wallet_transaction(uid, 'purchase', -pl.price_usd,
      pl.name || ' supplier plan (1 month)', 'supplier_plan:' || pl.code, 'personal');
  END IF;

  INSERT INTO public.supplier_subscriptions (supplier_id, plan_code, started_at, renews_at)
  VALUES (sup.id, pl.code, now(), CASE WHEN pl.price_usd > 0 THEN now() + interval '1 month' ELSE NULL END)
  ON CONFLICT (supplier_id) DO UPDATE
    SET plan_code = EXCLUDED.plan_code, started_at = now(), renews_at = EXCLUDED.renews_at, updated_at = now()
  RETURNING * INTO sub;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'supplier_plan', pl.name || ' plan active',
    'Your store is now on the ' || pl.name || ' plan (' || to_char(pl.commission_rate * 100, 'FM990.0') || '% commission).',
    '/store/plans');

  RETURN jsonb_build_object('ok', true, 'plan', pl.code, 'renews_at', sub.renews_at,
    'commission_rate', pl.commission_rate, 'product_limit', pl.product_limit);
END; $$;
GRANT EXECUTE ON FUNCTION public.supplier_subscribe_plan(text) TO authenticated;

-- 7. Enforce listing cap
CREATE OR REPLACE FUNCTION public._enforce_supplier_product_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.supplier_plans; cnt integer;
BEGIN
  IF NEW.supplier_id IS NULL THEN RETURN NEW; END IF;
  pl := public.supplier_effective_plan(NEW.supplier_id);
  IF pl.product_limit IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM public.products WHERE supplier_id = NEW.supplier_id;
  IF cnt >= pl.product_limit THEN
    RAISE EXCEPTION 'Your % plan allows up to % products. Upgrade your plan to list more.', pl.name, pl.product_limit;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_supplier_product_limit ON public.products;
CREATE TRIGGER enforce_supplier_product_limit BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public._enforce_supplier_product_limit();

-- 8. Commission on product order settlement
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(_order_id uuid)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  order_record public.orders;
  seller_id uuid;
  debit_transaction public.wallet_transactions;
  pl public.supplier_plans;
  commission_amt numeric := 0;
  net_amt numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT o.* INTO order_record FROM public.orders o WHERE o.id = _order_id FOR UPDATE;

  IF order_record.id IS NULL OR order_record.buyer_id <> uid THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF order_record.payment_status = 'paid' THEN
    SELECT * INTO debit_transaction
    FROM public.wallet_transactions
    WHERE user_id = uid AND reference = order_record.id::text AND amount < 0 AND account = 'personal'
    ORDER BY created_at DESC LIMIT 1;
    IF debit_transaction.id IS NULL THEN
      RAISE EXCEPTION 'order is already marked paid without a wallet transaction';
    END IF;
    RETURN debit_transaction;
  END IF;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = order_record.supplier_id;
  IF seller_id IS NULL THEN
    RAISE EXCEPTION 'supplier owner not found';
  END IF;

  pl := public.supplier_effective_plan(order_record.supplier_id);
  commission_amt := round(COALESCE(order_record.total, 0) * COALESCE(pl.commission_rate, 0), 2);
  net_amt := COALESCE(order_record.total, 0) - commission_amt;

  debit_transaction := public.apply_wallet_transaction(
    uid, 'purchase', -order_record.total,
    'Order ' || COALESCE(order_record.ref_code, order_record.id::text),
    order_record.id::text, 'personal');

  PERFORM public.apply_wallet_transaction(
    seller_id, 'sale', net_amt,
    'Sale ' || COALESCE(order_record.ref_code, order_record.id::text)
      || CASE WHEN commission_amt > 0
              THEN ' (net of ' || to_char(pl.commission_rate * 100, 'FM990.0') || '% commission)'
              ELSE '' END,
    order_record.id::text, 'sales');

  INSERT INTO public.supplier_commissions (order_id, supplier_id, seller_id, plan_code, gross, rate, commission, net)
  VALUES (order_record.id, order_record.supplier_id, seller_id, pl.code,
          COALESCE(order_record.total, 0), COALESCE(pl.commission_rate, 0), commission_amt, net_amt)
  ON CONFLICT (order_id) DO NOTHING;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET payment_status = 'paid', payment_reference = debit_transaction.id::text, updated_at = now()
  WHERE id = order_record.id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (seller_id, 'payment_received', 'Sale received',
    'You earned $' || to_char(net_amt, 'FM999990.00') || ' in your sales balance.', '/wallet');

  RETURN debit_transaction;
END; $$;