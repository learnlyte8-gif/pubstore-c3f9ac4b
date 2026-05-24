
-- =========================================================
-- SHARED TRIPS (carpool / ride-share)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.shared_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  host_kind text NOT NULL DEFAULT 'peer' CHECK (host_kind IN ('peer','driver')),
  origin_address text NOT NULL,
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  dest_address text NOT NULL,
  dest_lat numeric NOT NULL,
  dest_lng numeric NOT NULL,
  departure_at timestamptz NOT NULL,
  seats_total int NOT NULL DEFAULT 3 CHECK (seats_total > 0 AND seats_total <= 8),
  seats_available int NOT NULL DEFAULT 3,
  seat_price numeric NOT NULL DEFAULT 0 CHECK (seat_price >= 0),
  currency text NOT NULL DEFAULT 'USD',
  vehicle_label text,
  vehicle_class text NOT NULL DEFAULT 'economy',
  notes text,
  current_lat numeric,
  current_lng numeric,
  heading numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shared_trips_open ON public.shared_trips (status, departure_at);
CREATE INDEX IF NOT EXISTS idx_shared_trips_host ON public.shared_trips (host_id);
CREATE INDEX IF NOT EXISTS idx_shared_trips_geo ON public.shared_trips (origin_lat, origin_lng);

ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open trips are viewable by all auth users"
  ON public.shared_trips FOR SELECT TO authenticated
  USING (status IN ('open','full','in_progress') OR host_id = auth.uid());

CREATE POLICY "Host can insert their trip"
  ON public.shared_trips FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can update their trip"
  ON public.shared_trips FOR UPDATE TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "Host can delete their trip"
  ON public.shared_trips FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE TRIGGER trg_shared_trips_updated
  BEFORE UPDATE ON public.shared_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SHARED TRIP JOINS (passengers)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.shared_trip_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.shared_trips(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL,
  seats int NOT NULL DEFAULT 1 CHECK (seats > 0 AND seats <= 6),
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_address text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  payment_tx_id uuid,
  amount_due numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, rider_id)
);
CREATE INDEX IF NOT EXISTS idx_join_trip ON public.shared_trip_joins (trip_id);
CREATE INDEX IF NOT EXISTS idx_join_rider ON public.shared_trip_joins (rider_id);

ALTER TABLE public.shared_trip_joins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rider sees own joins, host sees joins on their trip"
  ON public.shared_trip_joins FOR SELECT TO authenticated
  USING (
    rider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.shared_trips t WHERE t.id = trip_id AND t.host_id = auth.uid())
  );

CREATE POLICY "Rider can request to join"
  ON public.shared_trip_joins FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Rider can cancel; host can accept/decline"
  ON public.shared_trip_joins FOR UPDATE TO authenticated
  USING (
    rider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.shared_trips t WHERE t.id = trip_id AND t.host_id = auth.uid())
  );

CREATE TRIGGER trg_shared_trip_joins_updated
  BEFORE UPDATE ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Default amount_due on insert
-- =========================================================
CREATE OR REPLACE FUNCTION public.shared_trip_join_set_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE price numeric;
BEGIN
  IF NEW.amount_due IS NULL THEN
    SELECT seat_price INTO price FROM public.shared_trips WHERE id = NEW.trip_id;
    NEW.amount_due := COALESCE(price, 0) * NEW.seats;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_shared_trip_join_amount
  BEFORE INSERT ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.shared_trip_join_set_amount();

-- =========================================================
-- Notifications
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_shared_trip_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE host_uid uuid; trip_to text; rider_name text;
BEGIN
  SELECT host_id, dest_address INTO host_uid, trip_to FROM public.shared_trips WHERE id = NEW.trip_id;
  SELECT COALESCE(display_name, username, 'A rider') INTO rider_name FROM public.profiles WHERE user_id = NEW.rider_id;
  IF host_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (host_uid, 'shared_trip_join_new',
      'New ride-share request',
      COALESCE(rider_name,'A rider') || ' wants ' || NEW.seats || ' seat' || CASE WHEN NEW.seats>1 THEN 's' ELSE '' END || ' to ' || COALESCE(trip_to,'your destination'),
      '/rides?pool_trip=' || NEW.trip_id || '&join=' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_new_shared_trip_join
  AFTER INSERT ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_shared_trip_join();

CREATE OR REPLACE FUNCTION public.notify_shared_trip_join_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE trip_to text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT dest_address INTO trip_to FROM public.shared_trips WHERE id = NEW.trip_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.rider_id, 'shared_trip_join_status',
    'Ride-share ' || NEW.status,
    'Your seat to ' || COALESCE(trip_to,'the destination') || ' is now ' || NEW.status,
    CASE WHEN NEW.status = 'accepted' AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/shared-trip-seat/' || NEW.id
         ELSE '/rides?pool_trip=' || NEW.trip_id END);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_shared_trip_join_status
  AFTER UPDATE ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.notify_shared_trip_join_status();

-- =========================================================
-- Match RPC — auto-suggest trips near rider's route
-- =========================================================
CREATE OR REPLACE FUNCTION public.match_shared_trips(
  _pickup_lat numeric, _pickup_lng numeric,
  _dropoff_lat numeric, _dropoff_lng numeric,
  _radius_km numeric DEFAULT 4
)
RETURNS SETOF public.shared_trips
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.* FROM public.shared_trips t
  WHERE t.status = 'open'
    AND t.seats_available > 0
    AND t.departure_at > now() - interval '15 minutes'
    AND (
      6371 * acos(
        cos(radians(_pickup_lat)) * cos(radians(t.origin_lat))
        * cos(radians(t.origin_lng) - radians(_pickup_lng))
        + sin(radians(_pickup_lat)) * sin(radians(t.origin_lat))
      )
    ) <= _radius_km
    AND (
      6371 * acos(
        cos(radians(_dropoff_lat)) * cos(radians(t.dest_lat))
        * cos(radians(t.dest_lng) - radians(_dropoff_lng))
        + sin(radians(_dropoff_lat)) * sin(radians(t.dest_lat))
      )
    ) <= _radius_km * 1.5
  ORDER BY t.departure_at ASC
  LIMIT 20;
$$;

-- =========================================================
-- Extend PUBSTORE Pay to handle shared-trip-seat
-- =========================================================
CREATE OR REPLACE FUNCTION public.pay_service_action_with_wallet(_kind text, _record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    COALESCE(title_text, _kind) || ' payment', ref_code);
  IF supplier_uid IS NOT NULL THEN
    PERFORM public.apply_wallet_transaction(supplier_uid, 'topup', amount,
      'Payout for ' || COALESCE(title_text, _kind), ref_code);
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
      'Payment received',
      'You were paid $' || to_char(amount,'FM999990.00') || ' via PUBSTORE Pay for ' || COALESCE(title_text, _kind),
      '/wallet');
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount', amount, 'tx_id', debit_tx.id);
END;
$$;

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_trip_joins;
