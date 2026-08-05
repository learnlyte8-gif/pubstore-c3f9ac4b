CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  _amount numeric,
  _method text,
  _destination text,
  _account_name text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _account text DEFAULT 'personal'
)
RETURNS public.withdrawal_requests
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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF acct NOT IN ('personal','sales') THEN RAISE EXCEPTION 'invalid account'; END IF;
  IF _amount IS NULL OR _amount < 5 THEN RAISE EXCEPTION 'minimum withdrawal is $5.00'; END IF;
  IF _amount > 10000 THEN RAISE EXCEPTION 'amount exceeds per-request limit'; END IF;
  IF _method IS NULL OR length(trim(_method)) = 0 THEN RAISE EXCEPTION 'method required'; END IF;
  IF _destination IS NULL OR length(trim(_destination)) < 3 THEN RAISE EXCEPTION 'destination required'; END IF;

  ref := 'WTH-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);

  debit_tx := public.apply_wallet_transaction(
    uid, 'withdrawal_hold', -_amount,
    'Withdrawal requested · ' || _method,
    ref,
    acct
  );

  INSERT INTO public.withdrawal_requests
    (user_id, amount, method, destination, account_name, notes, reference, hold_tx_id, status)
  VALUES
    (uid, _amount, _method, _destination, _account_name, _notes, ref, debit_tx.id, 'pending')
  RETURNING * INTO req;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'withdrawal_submitted',
    'Withdrawal request submitted',
    'Your withdrawal of $' || to_char(_amount, 'FM999999990.00') || ' from your ' || acct || ' balance is pending review.',
    '/wallet');

  RETURN req;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_wallet_withdrawal(numeric, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(numeric, text, text, text, text, text) TO authenticated;