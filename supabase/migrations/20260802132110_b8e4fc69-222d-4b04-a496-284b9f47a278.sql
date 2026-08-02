CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(_order_id uuid)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  order_record public.orders;
  seller_id uuid;
  debit_transaction public.wallet_transactions;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT o.* INTO order_record
  FROM public.orders o
  WHERE o.id = _order_id
  FOR UPDATE;

  IF order_record.id IS NULL OR order_record.buyer_id <> uid THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF order_record.payment_status = 'paid' THEN
    SELECT * INTO debit_transaction
    FROM public.wallet_transactions
    WHERE user_id = uid
      AND reference = order_record.id::text
      AND amount < 0
      AND account = 'personal'
    ORDER BY created_at DESC
    LIMIT 1;

    IF debit_transaction.id IS NULL THEN
      RAISE EXCEPTION 'order is already marked paid without a wallet transaction';
    END IF;

    RETURN debit_transaction;
  END IF;

  SELECT owner_id INTO seller_id
  FROM public.suppliers
  WHERE id = order_record.supplier_id;

  IF seller_id IS NULL THEN
    RAISE EXCEPTION 'supplier owner not found';
  END IF;

  debit_transaction := public.apply_wallet_transaction(
    uid,
    'purchase',
    -order_record.total,
    'Order ' || COALESCE(order_record.ref_code, order_record.id::text),
    order_record.id::text,
    'personal'
  );

  PERFORM public.apply_wallet_transaction(
    seller_id,
    'sale',
    order_record.total,
    'Sale ' || COALESCE(order_record.ref_code, order_record.id::text),
    order_record.id::text,
    'sales'
  );

  -- Trusted server-side settlement: allow the protected payment/escrow writes
  -- for this transaction only.
  PERFORM set_config('app.settlement', 'on', true);
  PERFORM set_config('app.allow_escrow_write', 'yes', true);

  UPDATE public.orders
  SET payment_status = 'paid',
      payment_reference = debit_transaction.id::text,
      updated_at = now()
  WHERE id = order_record.id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    seller_id,
    'payment_received',
    'Sale received',
    'You earned $' || to_char(order_record.total, 'FM999990.00') || ' in your sales balance.',
    '/wallet'
  );

  RETURN debit_transaction;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_order_with_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;