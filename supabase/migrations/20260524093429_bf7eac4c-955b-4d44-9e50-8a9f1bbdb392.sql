
-- 1) Add payment columns
ALTER TABLE public.stay_bookings        ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid, ADD COLUMN IF NOT EXISTS amount_due numeric;
ALTER TABLE public.car_rental_bookings  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid, ADD COLUMN IF NOT EXISTS amount_due numeric;
ALTER TABLE public.property_inquiries   ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid, ADD COLUMN IF NOT EXISTS amount_due numeric NOT NULL DEFAULT 2.00;
ALTER TABLE public.finance_applications ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid, ADD COLUMN IF NOT EXISTS amount_due numeric NOT NULL DEFAULT 2.00;
ALTER TABLE public.vehicle_inquiries    ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid, ADD COLUMN IF NOT EXISTS amount_due numeric NOT NULL DEFAULT 2.00;
ALTER TABLE public.service_bids         ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid;
ALTER TABLE public.logistics_bids       ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_tx_id uuid;

-- 2) Unified payment RPC
CREATE OR REPLACE FUNCTION public.pay_service_action_with_wallet(_kind text, _record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  buyer_uid uuid;
  supplier_uid uuid;
  amount numeric;
  already_paid boolean;
  current_status text;
  ref_code text;
  debit_tx public.wallet_transactions;
  title_text text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  ref_code := upper(_kind) || '-' || substr(replace(_record_id::text,'-',''),1,8);

  IF _kind = 'stay' THEN
    SELECT b.guest_id, s.owner_id, b.total, b.paid, b.status, st.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM stay_bookings b JOIN stays st ON st.id = b.stay_id
                           JOIN suppliers s ON s.id = st.supplier_id
      WHERE b.id = _record_id;
  ELSIF _kind = 'car-rental' THEN
    SELECT b.renter_id, r.owner_user_id, COALESCE(b.estimated_total, 0), b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM car_rental_bookings b JOIN car_rentals r ON r.id = b.rental_id
      WHERE b.id = _record_id;
  ELSIF _kind = 'property' THEN
    SELECT i.inquirer_id, p.owner_user_id, i.amount_due, i.paid, i.status, p.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM property_inquiries i JOIN properties p ON p.id = i.property_id
      WHERE i.id = _record_id;
  ELSIF _kind = 'finance' THEN
    SELECT a.applicant_id, p.owner_user_id, a.amount_due, a.paid, a.status, p.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM finance_applications a JOIN finance_products p ON p.id = a.product_id
      WHERE a.id = _record_id;
  ELSIF _kind = 'vehicle' THEN
    SELECT i.buyer_id, s.owner_id, i.amount_due, i.paid, i.status, v.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM vehicle_inquiries i JOIN vehicles v ON v.id = i.vehicle_id
                                JOIN suppliers s ON s.id = v.supplier_id
      WHERE i.id = _record_id;
  ELSIF _kind = 'service-bid' THEN
    SELECT r.buyer_id, b.provider_user_id, b.price, b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM service_bids b JOIN service_requests r ON r.id = b.request_id
      WHERE b.id = _record_id;
  ELSIF _kind = 'logistics-bid' THEN
    SELECT r.buyer_id, b.driver_id, b.fare, b.paid, b.status, r.title
      INTO buyer_uid, supplier_uid, amount, already_paid, current_status, title_text
      FROM logistics_bids b JOIN logistics_requests r ON r.id = b.request_id
      WHERE b.id = _record_id;
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

  debit_tx := public.apply_wallet_transaction(
    uid, 'purchase', -amount,
    COALESCE(title_text, _kind) || ' payment',
    ref_code
  );
  IF supplier_uid IS NOT NULL THEN
    PERFORM public.apply_wallet_transaction(
      supplier_uid, 'topup', amount,
      'Payout for ' || COALESCE(title_text, _kind),
      ref_code
    );
  END IF;

  IF _kind = 'stay' THEN
    UPDATE stay_bookings SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'car-rental' THEN
    UPDATE car_rental_bookings SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'property' THEN
    UPDATE property_inquiries SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'finance' THEN
    UPDATE finance_applications SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'vehicle' THEN
    UPDATE vehicle_inquiries SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'service-bid' THEN
    UPDATE service_bids SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  ELSIF _kind = 'logistics-bid' THEN
    UPDATE logistics_bids SET paid = true, paid_at = now(), payment_tx_id = debit_tx.id WHERE id = _record_id;
  END IF;

  IF supplier_uid IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (supplier_uid, 'payment_received',
      'Payment received',
      'You were paid $' || to_char(amount,'FM999990.00') || ' via PUBSTORE Pay for ' || COALESCE(title_text, _kind),
      '/wallet');
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount', amount, 'tx_id', debit_tx.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_service_action_with_wallet(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_service_action_with_wallet(text, uuid) TO authenticated;

-- 3) Update status-change triggers to also emit "Pay now" deep-link when accepted
CREATE OR REPLACE FUNCTION public.notify_stay_booking_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE stay_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO stay_title FROM stays WHERE id = NEW.stay_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.guest_id, 'stay_booking_status',
    'Booking ' || NEW.status,
    COALESCE(stay_title,'Your stay') || ' booking is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','approved','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/stay/' || NEW.id ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_car_rental_booking_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE rental_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO rental_title FROM car_rentals WHERE id = NEW.rental_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.renter_id, 'car_rental_booking_status',
    'Rental ' || NEW.status,
    COALESCE(rental_title,'Your rental') || ' is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','approved','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/car-rental/' || NEW.id ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_property_inquiry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE prop_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO prop_title FROM properties WHERE id = NEW.property_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.inquirer_id, 'property_inquiry_status',
    'Inquiry ' || NEW.status,
    'Your inquiry for ' || COALESCE(prop_title,'a property') || ' is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','approved','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/property/' || NEW.id ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_finance_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE prod_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO prod_title FROM finance_products WHERE id = NEW.product_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.applicant_id, 'finance_application_status',
    'Application ' || NEW.status,
    'Your application for ' || COALESCE(prod_title,'a finance product') || ' is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','approved','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/finance/' || NEW.id ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_vehicle_inquiry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE veh_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO veh_title FROM vehicles WHERE id = NEW.vehicle_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.buyer_id, 'vehicle_inquiry_status',
    'Inquiry ' || NEW.status,
    'Your inquiry for ' || COALESCE(veh_title,'a vehicle') || ' is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','approved','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/vehicle/' || NEW.id ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_service_bid_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE req_title text; buyer_uid uuid;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title, buyer_id INTO req_title, buyer_uid FROM service_requests WHERE id = NEW.request_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.provider_user_id, 'service_bid_status',
    'Bid ' || NEW.status,
    'Your bid on ' || COALESCE(req_title,'a service request') || ' is now ' || NEW.status,
    '/services?bid=' || NEW.id);
  IF NEW.status IN ('accepted','awarded','approved') AND NOT COALESCE(NEW.paid,false) AND buyer_uid IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (buyer_uid, 'service_bid_pay',
      'Pay your accepted bid',
      'Complete payment via PUBSTORE Pay for ' || COALESCE(req_title,'your service'),
      '/pay/service-bid/' || NEW.id);
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.notify_logistics_bid_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE req_title text; buyer_uid uuid;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title, buyer_id INTO req_title, buyer_uid FROM logistics_requests WHERE id = NEW.request_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.driver_id, 'logistics_bid_status',
    'Bid ' || NEW.status,
    'Your bid on ' || COALESCE(req_title,'a delivery') || ' is now ' || NEW.status,
    '/driver?bid=' || NEW.id);
  IF NEW.status IN ('accepted','awarded','approved') AND NOT COALESCE(NEW.paid,false) AND buyer_uid IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (buyer_uid, 'logistics_bid_pay',
      'Pay your courier',
      'Complete payment via PUBSTORE Pay for ' || COALESCE(req_title,'your delivery'),
      '/pay/logistics-bid/' || NEW.id);
  END IF;
  RETURN NEW;
END $fn$;
