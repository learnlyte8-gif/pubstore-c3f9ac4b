CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(_amount numeric, _method text, _destination text, _account_name text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _account text DEFAULT 'personal'::text)
 RETURNS withdrawal_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  ref TEXT;
  acct TEXT := COALESCE(NULLIF(trim(_account), ''), 'personal');
  debit_tx public.wallet_transactions;
  req public.withdrawal_requests;
  avail NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF acct NOT IN ('personal','sales') THEN RAISE EXCEPTION 'invalid account'; END IF;
  IF _amount IS NULL OR _amount < 5 THEN RAISE EXCEPTION 'minimum withdrawal is $5.00'; END IF;
  IF _amount > 10000 THEN RAISE EXCEPTION 'amount exceeds per-request limit'; END IF;
  IF _method IS NULL OR length(trim(_method)) = 0 THEN RAISE EXCEPTION 'method required'; END IF;
  IF _destination IS NULL OR length(trim(_destination)) < 3 THEN RAISE EXCEPTION 'destination required'; END IF;

  INSERT INTO public.wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;

  -- Lock the wallet row so concurrent requests can't both pass the balance check.
  SELECT CASE WHEN acct = 'sales' THEN sales_balance ELSE balance END
    INTO avail
    FROM public.wallets
    WHERE user_id = uid
    FOR UPDATE;

  IF COALESCE(avail, 0) < _amount THEN
    RAISE EXCEPTION 'insufficient % balance', acct;
  END IF;

  ref := 'WTH-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);

  debit_tx := public.apply_wallet_transaction(
    uid, 'withdrawal_hold', -_amount,
    'Withdrawal requested · ' || _method,
    ref,
    acct
  );

  INSERT INTO public.withdrawal_requests
    (user_id, amount, method, destination, account_name, notes, reference, hold_tx_id, status, account)
  VALUES
    (uid, _amount, _method, _destination, _account_name, _notes, ref, debit_tx.id, 'pending', acct)
  RETURNING * INTO req;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'withdrawal_submitted',
    'Withdrawal request submitted',
    'Your withdrawal of $' || to_char(_amount, 'FM999999990.00') || ' from your ' || acct || ' balance is held and pending review.',
    '/wallet');

  RETURN req;
END;
$function$;