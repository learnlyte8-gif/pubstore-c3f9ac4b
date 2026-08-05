-- Auto-settle (refund buyer) whenever an order becomes cancelled, from any path.
CREATE OR REPLACE FUNCTION public._auto_settle_cancelled_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE seller_id uuid; amt numeric;
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
    PERFORM public.apply_wallet_transaction(
      NEW.buyer_id, 'refund', amt,
      'Refund for cancelled order ' || COALESCE(NEW.ref_code, NEW.id::text),
      NEW.id::text, 'personal');

    UPDATE public.orders
    SET escrow_status = 'refunded',
        payment_status = 'refunded',
        refund_status = 'refunded',
        refund_requested_at = COALESCE(refund_requested_at, now()),
        refund_resolved_at = now(),
        dispute_opened_at = NULL,
        updated_at = now()
    WHERE id = NEW.id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.buyer_id, 'order_status', 'Order cancelled — refunded',
      'Order ' || COALESCE(NEW.ref_code, NEW.id::text)
      || ' was cancelled and $' || to_char(amt, 'FM999990.00') || ' was returned to your wallet.', '/wallet');
  ELSIF COALESCE(NEW.refund_status,'none') = 'requested' THEN
    -- unpaid / no escrow: close out any open request
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
END; $function$;

DROP TRIGGER IF EXISTS trg_auto_settle_cancelled_order ON public.orders;
CREATE TRIGGER trg_auto_settle_cancelled_order
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public._auto_settle_cancelled_order();

-- Refund approval stays admin-only.
REVOKE EXECUTE ON FUNCTION public.resolve_order_refund(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_order_refund(uuid, boolean, text) TO authenticated;