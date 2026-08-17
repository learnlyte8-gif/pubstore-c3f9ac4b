-- Refund every contributor of an order (group buys are paid by many wallets).
CREATE OR REPLACE FUNCTION public.refund_order_contributors(_order_id uuid, _label text DEFAULT 'Refund for order')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders;
  r record;
  total_refunded numeric := 0;
  amt numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;

  FOR r IN
    SELECT t.user_id,
           SUM(-t.amount) AS paid
    FROM public.wallet_transactions t
    WHERE t.reference = o.id::text
      AND t.account = 'personal'
      AND t.kind = 'purchase'
      AND t.amount < 0
    GROUP BY t.user_id
  LOOP
    -- Skip anyone already refunded for this order
    SELECT COALESCE(SUM(t.amount), 0) INTO amt
    FROM public.wallet_transactions t
    WHERE t.reference = o.id::text
      AND t.account = 'personal'
      AND t.kind = 'refund'
      AND t.user_id = r.user_id;

    amt := r.paid - COALESCE(amt, 0);
    IF amt <= 0 THEN CONTINUE; END IF;

    PERFORM public.apply_wallet_transaction(
      r.user_id, 'refund', amt,
      _label || ' ' || COALESCE(o.ref_code, o.id::text),
      o.id::text, 'personal');
    total_refunded := total_refunded + amt;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'order_status', 'Refund processed',
      '$' || to_char(amt, 'FM999990.00') || ' for order '
      || COALESCE(o.ref_code, o.id::text) || ' was returned to your wallet.', '/wallet');
  END LOOP;

  -- Fallback: no wallet debits on record (card/mobile money) -> refund the buyer the held amount
  IF total_refunded = 0 THEN
    amt := COALESCE(o.escrow_amount, o.total, 0);
    IF amt > 0 THEN
      PERFORM public.apply_wallet_transaction(
        o.buyer_id, 'refund', amt,
        _label || ' ' || COALESCE(o.ref_code, o.id::text),
        o.id::text, 'personal');
      total_refunded := amt;

      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (o.buyer_id, 'order_status', 'Refund processed',
        '$' || to_char(amt, 'FM999990.00') || ' for order '
        || COALESCE(o.ref_code, o.id::text) || ' was returned to your wallet.', '/wallet');
    END IF;
  END IF;

  RETURN total_refunded;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_order_contributors(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_order_contributors(uuid, text) TO service_role;

-- Admin refund resolution now refunds all contributors
CREATE OR REPLACE FUNCTION public.resolve_order_refund(_order_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      PERFORM public.refund_order_contributors(o.id, 'Refund for order');
    END IF;
    PERFORM set_config('app.cancel_settlement', 'on', true);
    UPDATE public.orders
    SET refund_status = 'refunded', refund_resolved_at = now(), refund_admin_note = _note,
        escrow_status = 'refunded', payment_status = 'refunded',
        status = 'cancelled'::order_status, updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;

    IF seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (seller_id, 'order_status', 'Refund approved',
        'Support approved the refund for order ' || COALESCE(o.ref_code, o.id::text)
        || '. The order is cancelled and the payment returned to the buyer(s).', '/store/orders');
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
END; $$;

-- Cancellation auto-refund now refunds all contributors
CREATE OR REPLACE FUNCTION public._auto_settle_cancelled_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE seller_id uuid; amt numeric; refunded numeric := 0;
BEGIN
  IF current_setting('app.cancel_settlement', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text <> 'cancelled' OR COALESCE(OLD.status::text,'') = 'cancelled' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.cancel_settlement', 'on', true);
  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  amt := COALESCE(NEW.escrow_amount, NEW.total, 0);

  IF COALESCE(NEW.escrow_status,'none') IN ('held','disputed') AND amt > 0 THEN
    refunded := public.refund_order_contributors(NEW.id, 'Refund for cancelled order');

    UPDATE public.orders
    SET escrow_status = 'refunded',
        payment_status = 'refunded',
        refund_status = 'refunded',
        refund_requested_at = COALESCE(refund_requested_at, now()),
        refund_resolved_at = now(),
        dispute_opened_at = NULL,
        updated_at = now()
    WHERE id = NEW.id;
  ELSIF COALESCE(NEW.refund_status,'none') = 'requested' THEN
    UPDATE public.orders
    SET refund_status = 'refunded', refund_resolved_at = now(), dispute_opened_at = NULL, updated_at = now()
    WHERE id = NEW.id;
  END IF;

  SELECT owner_id INTO seller_id FROM public.suppliers WHERE id = NEW.supplier_id;
  IF seller_id IS NOT NULL AND seller_id <> NEW.buyer_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (seller_id, 'order_status', 'Order cancelled',
      'Order ' || COALESCE(NEW.ref_code, NEW.id::text) || ' was cancelled and settled.', '/store/orders');
  END IF;

  RETURN NEW;
END; $$;