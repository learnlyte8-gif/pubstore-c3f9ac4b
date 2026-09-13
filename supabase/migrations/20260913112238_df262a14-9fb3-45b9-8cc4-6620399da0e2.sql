CREATE OR REPLACE FUNCTION public._create_promo_commissions(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ON CONFLICT (order_item_id, promoter_id) WHERE order_item_id IS NOT NULL DO NOTHING;
  END LOOP;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT c.promoter_id, 'promoter_sale', 'You made a sale!',
         'Your commission of $' || to_char(SUM(c.commission_amount), 'FM999990.00')
           || ' has been added to your pending earnings.', '/promote/earnings'
    FROM public.commissions c
   WHERE c.order_id = o.id AND c.status = 'pending'
   GROUP BY c.promoter_id;
END;
$function$;