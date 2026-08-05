-- Buyer confirms delivery: block cancelled/refunded orders + notify seller
CREATE OR REPLACE FUNCTION public.buyer_confirm_order_delivered(_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders; seller_id uuid; was_held boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can confirm delivery'; END IF;
  IF o.status::text = 'cancelled' THEN RAISE EXCEPTION 'this order was cancelled'; END IF;
  IF COALESCE(o.refund_status,'none') = 'refunded' THEN RAISE EXCEPTION 'this order was refunded'; END IF;
  IF o.supplier_marked_delivered_at IS NULL THEN
    RAISE EXCEPTION 'the seller has not marked this order as delivered yet';
  END IF;
  IF o.refund_status = 'requested' THEN RAISE EXCEPTION 'a refund request is open on this order'; END IF;

  was_held := COALESCE(o.escrow_status,'none') = 'held';

  UPDATE public.orders
  SET buyer_confirmed_delivered_at = COALESCE(buyer_confirmed_delivered_at, now()),
      status = 'delivered'::order_status,
      updated_at = now()
  WHERE id = _order_id RETURNING * INTO o;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = o.supplier_id;
  IF seller_id IS NOT NULL AND seller_id <> o.buyer_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (seller_id, 'order_status', 'Buyer confirmed delivery',
      'The buyer confirmed delivery of order ' || COALESCE(o.ref_code, o.id::text)
      || CASE WHEN was_held THEN '. The held payment is being released.' ELSE '.' END,
      '/store/orders');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.buyer_id, 'order_status', 'Delivery confirmed',
    'Thanks for confirming delivery of order ' || COALESCE(o.ref_code, o.id::text) || '.', '/orders');

  IF was_held THEN
    o := public._settle_order_escrow(_order_id);
  END IF;

  RETURN o;
END; $function$;

-- Refund request: also confirm to buyer and alert admins
CREATE OR REPLACE FUNCTION public.request_order_refund(_order_id uuid, _reason text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders; seller_id uuid; admin_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'please describe the reason for the refund';
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can request a refund'; END IF;
  IF o.status::text = 'delivered' OR o.buyer_confirmed_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'this order is already delivered, a refund can no longer be requested';
  END IF;
  IF o.status::text = 'cancelled' THEN RAISE EXCEPTION 'order is cancelled'; END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'this order has not been paid yet'; END IF;
  IF o.refund_status = 'requested' THEN RAISE EXCEPTION 'a refund request is already open'; END IF;
  IF o.refund_status = 'refunded' THEN RAISE EXCEPTION 'this order was already refunded'; END IF;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET refund_status = 'requested',
      refund_reason = btrim(_reason),
      refund_requested_at = now(),
      dispute_opened_at = now(),
      dispute_reason = btrim(_reason),
      escrow_status = CASE WHEN escrow_status = 'held' THEN 'disputed' ELSE escrow_status END,
      updated_at = now()
  WHERE id = _order_id RETURNING * INTO o;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = o.supplier_id;
  IF seller_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (seller_id, 'order_status', 'Refund requested',
      'The buyer requested a refund for order ' || COALESCE(o.ref_code, o.id::text)
      || ': ' || btrim(_reason), '/store/orders');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.buyer_id, 'order_status', 'Refund request submitted',
    'We received your refund request for order ' || COALESCE(o.ref_code, o.id::text)
    || '. Support will review it and the payment stays protected until then.', '/orders');

  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (admin_id, 'order_status', 'Refund needs review',
      'Order ' || COALESCE(o.ref_code, o.id::text) || ' has an open refund request.', '/admin');
  END LOOP;

  RETURN o;
END; $function$;

-- Buyer cancellation: let the auto-settle trigger handle refund + notifications for both parties
CREATE OR REPLACE FUNCTION public.cancel_order_by_buyer(_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can cancel this order'; END IF;
  IF o.status::text = 'cancelled' THEN RAISE EXCEPTION 'this order is already cancelled'; END IF;
  IF o.status::text NOT IN ('awaiting_payment','placed') THEN
    RAISE EXCEPTION 'this order is already being processed and can no longer be cancelled';
  END IF;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET status = 'cancelled'::order_status, updated_at = now()
  WHERE id = _order_id;

  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  RETURN o;
END; $function$;

-- Seller mark delivered: also block refunded orders
CREATE OR REPLACE FUNCTION public.supplier_mark_order_delivered(_order_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders; owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  SELECT owner_id INTO owner FROM public.suppliers WHERE id = o.supplier_id;
  IF owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'only the seller can mark this order delivered'; END IF;
  IF o.status::text = 'cancelled' THEN RAISE EXCEPTION 'order is cancelled'; END IF;
  IF COALESCE(o.refund_status,'none') = 'refunded' THEN RAISE EXCEPTION 'this order was refunded'; END IF;
  IF o.refund_status = 'requested' THEN RAISE EXCEPTION 'a refund request is open on this order'; END IF;

  UPDATE public.orders
  SET supplier_marked_delivered_at = COALESCE(supplier_marked_delivered_at, now()),
      status = CASE WHEN status::text IN ('placed','processing') THEN 'shipped'::order_status ELSE status END,
      updated_at = now()
  WHERE id = _order_id RETURNING * INTO o;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (o.buyer_id, 'order_status', 'Seller marked your order delivered',
    'Confirm delivery to release the payment for order '
    || COALESCE(o.ref_code, o.id::text) || '.', '/orders');

  RETURN o;
END; $function$;

-- Admin refund resolution: notify the seller as well
CREATE OR REPLACE FUNCTION public.resolve_order_refund(_order_id uuid, _approve boolean, _note text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders; seller_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.refund_status <> 'requested' THEN RAISE EXCEPTION 'no open refund request'; END IF;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = o.supplier_id;

  IF _approve THEN
    IF COALESCE(o.escrow_status,'none') IN ('held','disputed') THEN
      PERFORM public.apply_wallet_transaction(
        o.buyer_id, 'refund', COALESCE(o.escrow_amount, o.total, 0),
        'Refund for order ' || COALESCE(o.ref_code, o.id::text),
        o.id::text, 'personal');
    END IF;
    PERFORM set_config('app.cancel_settlement', 'on', true);
    UPDATE public.orders
    SET refund_status = 'refunded', refund_resolved_at = now(), refund_admin_note = _note,
        escrow_status = 'refunded', payment_status = 'refunded',
        status = 'cancelled'::order_status, updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (o.buyer_id, 'order_status', 'Refund approved',
      'Your refund for order ' || COALESCE(o.ref_code, o.id::text) || ' was returned to your wallet.', '/wallet');

    IF seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (seller_id, 'order_status', 'Refund approved',
        'Support approved the refund for order ' || COALESCE(o.ref_code, o.id::text)
        || '. The order is cancelled and the payment returned to the buyer.', '/store/orders');
    END IF;
  ELSE
    UPDATE public.orders
    SET refund_status = 'declined', refund_resolved_at = now(), refund_admin_note = _note,
        escrow_status = CASE WHEN escrow_status = 'disputed' THEN 'held' ELSE escrow_status END,
        dispute_opened_at = NULL, updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (o.buyer_id, 'order_status', 'Refund declined',
      'Your refund request for order ' || COALESCE(o.ref_code, o.id::text) || ' was declined.', '/orders');

    IF seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (seller_id, 'order_status', 'Refund declined',
        'Support declined the refund request for order ' || COALESCE(o.ref_code, o.id::text)
        || '. The payment stays protected until delivery is confirmed.', '/store/orders');
    END IF;
  END IF;

  RETURN o;
END; $function$;