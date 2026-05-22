CREATE OR REPLACE FUNCTION public.transfer_wallet_funds(_recipient_id uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id uuid := auth.uid();
  sender_name text;
  recipient_name text;
  debit_tx public.wallet_transactions;
  ref_code text;
BEGIN
  IF sender_id IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _recipient_id IS NULL THEN RAISE EXCEPTION 'recipient required'; END IF;
  IF _recipient_id = sender_id THEN RAISE EXCEPTION 'cannot send to yourself'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF _amount > 10000 THEN RAISE EXCEPTION 'amount exceeds per-transfer limit'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _recipient_id) THEN
    RAISE EXCEPTION 'recipient not found';
  END IF;

  SELECT COALESCE(display_name, username, 'a user') INTO sender_name FROM public.profiles WHERE user_id = sender_id;
  SELECT COALESCE(display_name, username, 'a user') INTO recipient_name FROM public.profiles WHERE user_id = _recipient_id;

  ref_code := 'TRF-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  debit_tx := public.apply_wallet_transaction(
    sender_id, 'transfer_out', -_amount,
    COALESCE(NULLIF(_note, ''), 'Sent to ' || recipient_name),
    ref_code
  );

  PERFORM public.apply_wallet_transaction(
    _recipient_id, 'transfer_in', _amount,
    COALESCE(NULLIF(_note, ''), 'Received from ' || sender_name),
    ref_code
  );

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    _recipient_id, 'wallet_transfer',
    'You received $' || to_char(_amount, 'FM999990.00'),
    COALESCE(sender_name, 'Someone') || ' sent you money on PUBSTORE Pay',
    '/wallet'
  );

  RETURN debit_tx;
END;
$$;