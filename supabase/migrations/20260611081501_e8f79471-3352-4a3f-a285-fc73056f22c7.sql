
-- 1. Schema changes
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS sales_balance numeric NOT NULL DEFAULT 0 CHECK (sales_balance >= 0);

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_kind_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_kind_check
  CHECK (kind = ANY (ARRAY[
    'topup','purchase','refund','adjustment',
    'transfer_in','transfer_out',
    'withdrawal_hold','payout',
    'sale','sales_to_personal_out','sales_to_personal_in'
  ]));

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'personal'
  CHECK (account IN ('personal','sales'));

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'personal'
  CHECK (account IN ('personal','sales'));

-- 2. apply_wallet_transaction now takes an _account argument
CREATE OR REPLACE FUNCTION public.apply_wallet_transaction(
  _user_id uuid,
  _kind text,
  _amount numeric,
  _description text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _account text DEFAULT 'personal'
)
RETURNS wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_balance numeric;
  tx public.wallet_transactions;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  IF _account NOT IN ('personal','sales') THEN RAISE EXCEPTION 'invalid account'; END IF;

  INSERT INTO public.wallets (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

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

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient % balance', _account;
  END IF;

  INSERT INTO public.wallet_transactions
    (user_id, kind, amount, balance_after, description, reference, account)
    VALUES (_user_id, _kind, _amount, new_balance, _description, _reference, _account)
    RETURNING * INTO tx;

  RETURN tx;
END;
$function$;

-- 3. pay_service_action_with_wallet: seller credit goes to SALES; buyer debit stays PERSONAL
CREATE OR REPLACE FUNCTION public.pay_service_action_with_wallet(_kind text, _record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  buyer_uid uuid; supplier_uid uuid;
  amount numeric; already_paid boolean; current_status text;
  ref_code text; debit_tx public.wallet_transactions; title_text text;
  trip_id_v uuid; seats_v int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  ref_code := upper(_kind) || '-' || substr(replace(_record_id::text,'-',''),1,8);

  IF _kind = 'stay' THEN
    SELECT b.guest_id, s.owner_id, b.total, b.paid, b.status, st.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM stay_bookings b JOIN stays st ON st.id = b.stay_id JOIN suppliers s ON s.id = st.supplier_id
      WHERE b.id = _record_id;
  ELSIF _kind = 'car-rental' THEN
    SELECT b.renter_id, r.owner_user_id, COALESCE(b.estimated_total, 0), b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM car_rental_bookings b JOIN car_rentals r ON r.id = b.rental_id WHERE b.id = _record_id;
  ELSIF _kind = 'property' THEN
    SELECT i.inquirer_id, p.owner_user_id, i.amount_due, i.paid, i.status, p.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM property_inquiries i JOIN properties p ON p.id = i.property_id WHERE i.id = _record_id;
  ELSIF _kind = 'finance' THEN
    SELECT a.applicant_id, p.owner_user_id, a.amount_due, a.paid, a.status, p.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM finance_applications a JOIN finance_products p ON p.id = a.product_id WHERE a.id = _record_id;
  ELSIF _kind = 'vehicle' THEN
    SELECT i.buyer_id, s.owner_id, i.amount_due, i.paid, i.status, v.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM vehicle_inquiries i JOIN vehicles v ON v.id = i.vehicle_id JOIN suppliers s ON s.id = v.supplier_id
      WHERE i.id = _record_id;
  ELSIF _kind = 'service-bid' THEN
    SELECT r.buyer_id, b.provider_user_id, b.price, b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM service_bids b JOIN service_requests r ON r.id = b.request_id WHERE b.id = _record_id;
  ELSIF _kind = 'logistics-bid' THEN
    SELECT r.buyer_id, b.driver_id, b.fare, b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM logistics_bids b JOIN logistics_requests r ON r.id = b.request_id WHERE b.id = _record_id;
  ELSIF _kind = 'shared-trip-seat' THEN
    SELECT j.rider_id, t.host_id, j.amount_due, j.paid, j.status, t.dest_address, j.trip_id, j.seats
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text, trip_id_v, seats_v
      FROM shared_trip_joins j JOIN shared_trips t ON t.id = j.trip_id WHERE j.id = _record_id;
  ELSE
    RAISE EXCEPTION 'unknown kind: %', _kind;
  END IF;

  IF buyer_uid IS NULL THEN RAISE EXCEPTION 'record not found'; END IF;
  IF buyer_uid <> uid THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF already_paid THEN RAISE EXCEPTION 'already paid'; END IF;
  IF amount IS NULL OR amount <= 0 THEN RAISE EXCEPTION 'no amount to pay'; END IF;
  IF current_status NOT IN ('accepted','approved','confirmed','awarded','assigned') THEN
    RAISE EXCEPTION 'not ready for payment (status: %)', current_status;
  END IF;

  debit_tx := public.apply_wallet_transaction(uid, 'purchase', -amount,
    COALESCE(title_text, _kind) || ' payment', ref_code, 'personal');
  IF supplier_uid IS NOT NULL THEN
    PERFORM public.apply_wallet_transaction(supplier_uid, 'sale', amount,
      'Sale: ' || COALESCE(title_text, _kind), ref_code, 'sales');
  END IF;

  IF _kind = 'stay' THEN UPDATE stay_bookings SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'car-rental' THEN UPDATE car_rental_bookings SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'property' THEN UPDATE property_inquiries SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'finance' THEN UPDATE finance_applications SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'vehicle' THEN UPDATE vehicle_inquiries SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'service-bid' THEN UPDATE service_bids SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'logistics-bid' THEN UPDATE logistics_bids SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
  ELSIF _kind = 'shared-trip-seat' THEN
    UPDATE shared_trip_joins SET paid=true, paid_at=now(), payment_tx_id=debit_tx.id WHERE id=_record_id;
    UPDATE shared_trips
      SET seats_available = GREATEST(0, seats_available - seats_v),
          status = CASE WHEN seats_available - seats_v <= 0 THEN 'full' ELSE status END
      WHERE id = trip_id_v;
  END IF;

  IF supplier_uid IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (supplier_uid, 'payment_received',
      'Sale received',
      'You earned $' || to_char(amount,'FM999990.00') || ' (added to sales balance) for ' || COALESCE(title_text, _kind),
      '/wallet');
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount', amount, 'tx_id', debit_tx.id);
END;
$function$;

-- 4. request_wallet_withdrawal now accepts _account
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  _amount numeric,
  _method text,
  _destination text,
  _account_name text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _account text DEFAULT 'personal'
)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid UUID := auth.uid();
  ref TEXT;
  debit_tx public.wallet_transactions;
  req public.withdrawal_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount IS NULL OR _amount < 5 THEN RAISE EXCEPTION 'minimum withdrawal is $5.00'; END IF;
  IF _amount > 10000 THEN RAISE EXCEPTION 'amount exceeds per-request limit'; END IF;
  IF _method IS NULL OR length(trim(_method)) = 0 THEN RAISE EXCEPTION 'method required'; END IF;
  IF _destination IS NULL OR length(trim(_destination)) < 3 THEN RAISE EXCEPTION 'destination required'; END IF;
  IF _account NOT IN ('personal','sales') THEN RAISE EXCEPTION 'invalid account'; END IF;

  ref := 'WTH-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);

  debit_tx := public.apply_wallet_transaction(
    uid, 'withdrawal_hold', -_amount,
    'Withdrawal requested · ' || _method || ' (' || _account || ')',
    ref,
    _account
  );

  INSERT INTO public.withdrawal_requests
    (user_id, amount, method, destination, account_name, notes, reference, hold_tx_id, status, account)
  VALUES
    (uid, _amount, _method, _destination, _account_name, _notes, ref, debit_tx.id, 'pending', _account)
  RETURNING * INTO req;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'withdrawal_submitted',
    'Withdrawal request submitted',
    'We are processing your $' || to_char(_amount,'FM999990.00') || ' withdrawal from your ' || _account || ' balance via ' || _method,
    '/wallet');

  RETURN req;
END;
$function$;

-- 5. cancel_withdrawal_request refunds the originating account
CREATE OR REPLACE FUNCTION public.cancel_withdrawal_request(_id uuid)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid UUID := auth.uid();
  req public.withdrawal_requests;
  refund_tx public.wallet_transactions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = _id;
  IF req.id IS NULL OR req.user_id <> uid THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'only pending requests can be cancelled'; END IF;

  refund_tx := public.apply_wallet_transaction(
    uid, 'refund', req.amount,
    'Withdrawal cancelled · refund',
    req.reference,
    COALESCE(req.account, 'personal')
  );

  UPDATE public.withdrawal_requests
    SET status = 'cancelled', payout_tx_id = refund_tx.id, processed_at = now()
    WHERE id = _id
    RETURNING * INTO req;

  RETURN req;
END;
$function$;

-- 6. transfer_wallet_funds: always personal -> personal
CREATE OR REPLACE FUNCTION public.transfer_wallet_funds(_recipient_id uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    ref_code, 'personal'
  );

  PERFORM public.apply_wallet_transaction(
    _recipient_id, 'transfer_in', _amount,
    COALESCE(NULLIF(_note, ''), 'Received from ' || sender_name),
    ref_code, 'personal'
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
$function$;

-- 7. NEW: move funds from sales -> personal (so users can withdraw or spend earnings)
CREATE OR REPLACE FUNCTION public.move_sales_to_personal(_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  ref text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  ref := 'S2P-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);

  PERFORM public.apply_wallet_transaction(uid, 'sales_to_personal_out', -_amount,
    'Moved to personal balance', ref, 'sales');
  PERFORM public.apply_wallet_transaction(uid, 'sales_to_personal_in', _amount,
    'Moved from sales balance', ref, 'personal');

  RETURN jsonb_build_object('ok', true, 'amount', _amount, 'reference', ref);
END;
$function$;
