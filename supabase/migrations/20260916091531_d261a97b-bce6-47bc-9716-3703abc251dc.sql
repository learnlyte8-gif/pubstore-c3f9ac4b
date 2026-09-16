CREATE OR REPLACE FUNCTION public.apply_wallet_transaction(_user_id uuid, _kind text, _amount numeric, _description text DEFAULT NULL::text, _reference text DEFAULT NULL::text, _account text DEFAULT 'personal'::text)
 RETURNS wallet_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric;
  new_balance numeric;
  transaction_record public.wallet_transactions;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;
  IF _amount = 0 THEN
    RAISE EXCEPTION 'amount must be non-zero';
  END IF;
  IF _account NOT IN ('personal', 'sales') THEN
    RAISE EXCEPTION 'invalid wallet account';
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the wallet row and pre-check funds so the friendly error is raised
  -- instead of the table-level CHECK (balance >= 0) constraint violation.
  IF _account = 'sales' THEN
    SELECT sales_balance INTO current_balance
    FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  ELSE
    SELECT balance INTO current_balance
    FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  END IF;

  current_balance := COALESCE(current_balance, 0);

  IF current_balance + _amount < 0 THEN
    RAISE EXCEPTION 'Insufficient % balance. Available: %, required: %',
      _account,
      to_char(current_balance, 'FM999999990.00'),
      to_char(-_amount, 'FM999999990.00')
      USING ERRCODE = 'P0001';
  END IF;

  IF _account = 'sales' THEN
    UPDATE public.wallets
    SET sales_balance = sales_balance + _amount,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING sales_balance INTO new_balance;
  ELSE
    UPDATE public.wallets
    SET balance = balance + _amount,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO new_balance;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, kind, amount, balance_after, description, reference, account)
  VALUES (_user_id, _kind, _amount, new_balance, _description, _reference, _account)
  RETURNING * INTO transaction_record;

  RETURN transaction_record;
END;
$function$;

-- One-time grandfathering: suppliers who already satisfied the pre-collection
-- onboarding requirements keep their ability to publish.
UPDATE public.suppliers s
SET onboarding_completed_at = now()
WHERE s.onboarding_completed_at IS NULL
  AND COALESCE(s.name, '') <> ''
  AND COALESCE(s.country, '') <> ''
  AND COALESCE(s.about, '') <> ''
  AND COALESCE(s.business_type, '') <> ''
  AND (COALESCE(s.phone, '') <> '' OR COALESCE(s.email, '') <> '')
  AND COALESCE(array_length(s.categories, 1), 0) > 0;