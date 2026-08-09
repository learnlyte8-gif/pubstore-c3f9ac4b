CREATE OR REPLACE FUNCTION public._settle_order_escrow(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders;
  seller_id uuid;
  pl public.supplier_plans;
  commission_amt numeric := 0;
  gross numeric := 0;
  ship_amt numeric := 0;
  goods_amt numeric := 0;
  net_amt numeric;
  courier_id uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF COALESCE(o.escrow_status,'none') <> 'held' THEN
    RAISE EXCEPTION 'no funds are being held in escrow for this order';
  END IF;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = o.supplier_id;
  IF seller_id IS NULL THEN RAISE EXCEPTION 'supplier owner not found'; END IF;

  gross := COALESCE(o.escrow_amount, o.total, 0);
  courier_id := o.delivery_courier_user_id;

  -- The delivery fee always belongs to the courier leg, even if the courier is the same user as the seller.
  IF courier_id IS NOT NULL THEN
    ship_amt := LEAST(GREATEST(COALESCE(o.shipping, 0), 0), gross);
  END IF;
  goods_amt := gross - ship_amt;

  pl := public.supplier_effective_plan(o.supplier_id);
  commission_amt := round(goods_amt * COALESCE(pl.commission_rate, 0), 2);
  net_amt := goods_amt - commission_amt;

  PERFORM public.apply_wallet_transaction(
    seller_id, 'sale', net_amt,
    'Sale ' || COALESCE(o.ref_code, o.id::text)
      || CASE WHEN commission_amt > 0
              THEN ' (net of ' || to_char(pl.commission_rate * 100, 'FM990.0') || '% commission)'
              ELSE '' END,
    o.id::text, 'sales');

  IF ship_amt > 0 THEN
    -- Credit the delivery fee to the courier. If the courier is the seller, it still lands
    -- in their sales wallet but as a separate delivery line, keeping commission off the fee.
    PERFORM public.apply_wallet_transaction(
      courier_id, 'sale', ship_amt,
      'Delivery fee ' || COALESCE(o.ref_code, o.id::text),
      o.id::text || ':delivery', 'sales');

    -- Notify the courier only when it is a separate delivery partner.
    IF courier_id <> seller_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (courier_id, 'payment_received', 'Delivery fee released',
        'Delivery confirmed. $' || to_char(ship_amt, 'FM999990.00') || ' was added to your sales balance.', '/wallet');
    END IF;
  END IF;

  INSERT INTO public.supplier_commissions (order_id, supplier_id, seller_id, plan_code, gross, rate, commission, net)
  VALUES (o.id, o.supplier_id, seller_id, pl.code,
          goods_amt, COALESCE(pl.commission_rate, 0), commission_amt, net_amt)
  ON CONFLICT (order_id) DO NOTHING;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET escrow_status = 'released', escrow_released_at = now(), updated_at = now()
  WHERE id = o.id RETURNING * INTO o;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (seller_id, 'payment_received', 'Funds released',
    'Delivery confirmed. $' || to_char(net_amt, 'FM999990.00') || ' was added to your sales balance.', '/wallet');

  RETURN o;
END;
$function$;