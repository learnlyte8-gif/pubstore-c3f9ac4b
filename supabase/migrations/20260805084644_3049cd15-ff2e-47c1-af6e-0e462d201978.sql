ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supplier_marked_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_admin_note text;

-- ---------------------------------------------------------------------------
-- 1. Payment now HOLDS funds in escrow instead of paying the seller instantly
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(_order_id uuid)
RETURNS wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  order_record public.orders;
  seller_id uuid;
  debit_transaction public.wallet_transactions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

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
  IF seller_id IS NULL THEN RAISE EXCEPTION 'supplier owner not found'; END IF;

  debit_transaction := public.apply_wallet_transaction(
    uid, 'purchase', -order_record.total,
    'Order ' || COALESCE(order_record.ref_code, order_record.id::text),
    order_record.id::text, 'personal');

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET payment_status = 'paid',
      payment_reference = debit_transaction.id::text,
      escrow_status = 'held',
      escrow_amount = COALESCE(order_record.total, 0),
      updated_at = now()
  WHERE id = order_record.id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (seller_id, 'payment_received', 'Order paid (funds held)',
    'Buyer paid $' || to_char(COALESCE(order_record.total,0), 'FM999990.00')
    || '. Funds are held in escrow until delivery is confirmed.', '/store/orders');

  RETURN debit_transaction;
END; $function$;

-- ---------------------------------------------------------------------------
-- 2. Internal settlement: release held funds to the seller
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._settle_order_escrow(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders;
  seller_id uuid;
  pl public.supplier_plans;
  commission_amt numeric := 0;
  net_amt numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF COALESCE(o.escrow_status,'none') <> 'held' THEN
    RAISE EXCEPTION 'no funds are being held in escrow for this order';
  END IF;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = o.supplier_id;
  IF seller_id IS NULL THEN RAISE EXCEPTION 'supplier owner not found'; END IF;

  pl := public.supplier_effective_plan(o.supplier_id);
  commission_amt := round(COALESCE(o.escrow_amount, o.total, 0) * COALESCE(pl.commission_rate, 0), 2);
  net_amt := COALESCE(o.escrow_amount, o.total, 0) - commission_amt;

  PERFORM public.apply_wallet_transaction(
    seller_id, 'sale', net_amt,
    'Sale ' || COALESCE(o.ref_code, o.id::text)
      || CASE WHEN commission_amt > 0
              THEN ' (net of ' || to_char(pl.commission_rate * 100, 'FM990.0') || '% commission)'
              ELSE '' END,
    o.id::text, 'sales');

  INSERT INTO public.supplier_commissions (order_id, supplier_id, seller_id, plan_code, gross, rate, commission, net)
  VALUES (o.id, o.supplier_id, seller_id, pl.code,
          COALESCE(o.escrow_amount, o.total, 0), COALESCE(pl.commission_rate, 0), commission_amt, net_amt)
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
END; $function$;

REVOKE ALL ON FUNCTION public._settle_order_escrow(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Supplier marks delivered
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplier_mark_order_delivered(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders; owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  SELECT owner_id INTO owner FROM public.suppliers WHERE id = o.supplier_id;
  IF owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'only the seller can mark this order delivered'; END IF;
  IF o.status::text = 'cancelled' THEN RAISE EXCEPTION 'order is cancelled'; END IF;
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

GRANT EXECUTE ON FUNCTION public.supplier_mark_order_delivered(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Buyer confirms delivery -> settles escrow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buyer_confirm_order_delivered(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can confirm delivery'; END IF;
  IF o.supplier_marked_delivered_at IS NULL THEN
    RAISE EXCEPTION 'the seller has not marked this order as delivered yet';
  END IF;
  IF o.refund_status = 'requested' THEN RAISE EXCEPTION 'a refund request is open on this order'; END IF;

  UPDATE public.orders
  SET buyer_confirmed_delivered_at = COALESCE(buyer_confirmed_delivered_at, now()),
      status = 'delivered'::order_status,
      updated_at = now()
  WHERE id = _order_id RETURNING * INTO o;

  IF COALESCE(o.escrow_status,'none') = 'held' THEN
    o := public._settle_order_escrow(_order_id);
  END IF;

  RETURN o;
END; $function$;

GRANT EXECUTE ON FUNCTION public.buyer_confirm_order_delivered(uuid) TO authenticated;

-- keep release_escrow working, but route it through the settlement path
CREATE OR REPLACE FUNCTION public.release_escrow(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can release escrow'; END IF;
  IF o.supplier_marked_delivered_at IS NULL THEN
    RAISE EXCEPTION 'the seller has not marked this order as delivered yet';
  END IF;
  RETURN public.buyer_confirm_order_delivered(_order_id);
END; $function$;

GRANT EXECUTE ON FUNCTION public.release_escrow(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Buyer refund request (only while not delivered)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_order_refund(_order_id uuid, _reason text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders; seller_id uuid;
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
      'The buyer requested a refund for order ' || COALESCE(o.ref_code, o.id::text) || '.', '/store/orders');
  END IF;

  RETURN o;
END; $function$;

GRANT EXECUTE ON FUNCTION public.request_order_refund(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Buyer cancel (blocked once the seller starts processing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order_by_buyer(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can cancel this order'; END IF;
  IF o.status::text NOT IN ('awaiting_payment','placed') THEN
    RAISE EXCEPTION 'this order is already being processed and can no longer be cancelled';
  END IF;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  IF COALESCE(o.escrow_status,'none') = 'held' THEN
    PERFORM public.apply_wallet_transaction(
      o.buyer_id, 'refund', COALESCE(o.escrow_amount, o.total, 0),
      'Refund for cancelled order ' || COALESCE(o.ref_code, o.id::text),
      o.id::text, 'personal');
    UPDATE public.orders
    SET escrow_status = 'refunded', payment_status = 'refunded',
        refund_status = 'refunded', refund_resolved_at = now()
    WHERE id = _order_id;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'::order_status, updated_at = now()
  WHERE id = _order_id RETURNING * INTO o;

  RETURN o;
END; $function$;

GRANT EXECUTE ON FUNCTION public.cancel_order_by_buyer(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Admin resolves a refund request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_order_refund(_order_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.refund_status <> 'requested' THEN RAISE EXCEPTION 'no open refund request'; END IF;

  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  IF _approve THEN
    IF COALESCE(o.escrow_status,'none') IN ('held','disputed') THEN
      PERFORM public.apply_wallet_transaction(
        o.buyer_id, 'refund', COALESCE(o.escrow_amount, o.total, 0),
        'Refund for order ' || COALESCE(o.ref_code, o.id::text),
        o.id::text, 'personal');
    END IF;
    UPDATE public.orders
    SET refund_status = 'refunded', refund_resolved_at = now(), refund_admin_note = _note,
        escrow_status = 'refunded', payment_status = 'refunded',
        status = 'cancelled'::order_status, updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (o.buyer_id, 'order_status', 'Refund approved',
      'Your refund for order ' || COALESCE(o.ref_code, o.id::text) || ' was returned to your wallet.', '/wallet');
  ELSE
    UPDATE public.orders
    SET refund_status = 'declined', refund_resolved_at = now(), refund_admin_note = _note,
        escrow_status = CASE WHEN escrow_status = 'disputed' THEN 'held' ELSE escrow_status END,
        dispute_opened_at = NULL, updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (o.buyer_id, 'order_status', 'Refund declined',
      'Your refund request for order ' || COALESCE(o.ref_code, o.id::text) || ' was declined.', '/orders');
  END IF;

  RETURN o;
END; $function$;

GRANT EXECUTE ON FUNCTION public.resolve_order_refund(uuid, boolean, text) TO authenticated;