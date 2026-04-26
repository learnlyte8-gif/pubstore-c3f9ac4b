-- ============================================================
-- Stay bookings
-- ============================================================
CREATE TABLE public.stay_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id uuid NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL DEFAULT 1,
  nights integer NOT NULL DEFAULT 1,
  nightly_rate numeric NOT NULL DEFAULT 0,
  cleaning_fee numeric NOT NULL DEFAULT 0,
  service_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending', -- pending|confirmed|cancelled|completed
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stay_bookings_stay ON public.stay_bookings(stay_id);
CREATE INDEX idx_stay_bookings_guest ON public.stay_bookings(guest_id);
CREATE INDEX idx_stay_bookings_dates ON public.stay_bookings(stay_id, check_in, check_out);

ALTER TABLE public.stay_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guest creates booking"
ON public.stay_bookings FOR INSERT
WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Guest or host reads booking"
ON public.stay_bookings FOR SELECT
USING (
  auth.uid() = guest_id
  OR EXISTS (
    SELECT 1 FROM public.stays st
    JOIN public.suppliers s ON s.id = st.supplier_id
    WHERE st.id = stay_bookings.stay_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Guest or host updates booking"
ON public.stay_bookings FOR UPDATE
USING (
  auth.uid() = guest_id
  OR EXISTS (
    SELECT 1 FROM public.stays st
    JOIN public.suppliers s ON s.id = st.supplier_id
    WHERE st.id = stay_bookings.stay_id AND s.owner_id = auth.uid()
  )
);

CREATE TRIGGER trg_stay_bookings_updated
BEFORE UPDATE ON public.stay_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Vehicle inquiries  (test drive / financing / general)
-- ============================================================
CREATE TABLE public.vehicle_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'inquiry', -- inquiry|test_drive|financing
  preferred_date date,
  contact_name text,
  contact_phone text,
  contact_email text,
  down_payment numeric,
  loan_term_months integer,
  estimated_monthly numeric,
  message text,
  status text NOT NULL DEFAULT 'open', -- open|scheduled|completed|cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_inquiries_vehicle ON public.vehicle_inquiries(vehicle_id);
CREATE INDEX idx_vehicle_inquiries_buyer ON public.vehicle_inquiries(buyer_id);

ALTER TABLE public.vehicle_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer creates inquiry"
ON public.vehicle_inquiries FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyer or dealer reads inquiry"
ON public.vehicle_inquiries FOR SELECT
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.vehicles v
    JOIN public.suppliers s ON s.id = v.supplier_id
    WHERE v.id = vehicle_inquiries.vehicle_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Buyer or dealer updates inquiry"
ON public.vehicle_inquiries FOR UPDATE
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.vehicles v
    JOIN public.suppliers s ON s.id = v.supplier_id
    WHERE v.id = vehicle_inquiries.vehicle_id AND s.owner_id = auth.uid()
  )
);

CREATE TRIGGER trg_vehicle_inquiries_updated
BEFORE UPDATE ON public.vehicle_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Saved vehicles (per-user wishlist)
-- ============================================================
CREATE TABLE public.vehicle_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vehicle_id)
);

CREATE INDEX idx_vehicle_saves_user ON public.vehicle_saves(user_id);

ALTER TABLE public.vehicle_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own saves all"
ON public.vehicle_saves FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Ride messages (rider <-> driver chat)
-- ============================================================
CREATE TABLE public.ride_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ride_messages_ride ON public.ride_messages(ride_id, created_at);

ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read ride msgs"
ON public.ride_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_messages.ride_id
      AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())
  )
);

CREATE POLICY "Participants send ride msgs"
ON public.ride_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_messages.ride_id
      AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;
ALTER TABLE public.ride_messages REPLICA IDENTITY FULL;

-- ============================================================
-- Ride ratings
-- ============================================================
CREATE TABLE public.ride_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  direction text NOT NULL, -- rider_to_driver | driver_to_rider
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id)
);

CREATE INDEX idx_ride_ratings_ratee ON public.ride_ratings(ratee_id);

ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ratings"
ON public.ride_ratings FOR SELECT USING (true);

CREATE POLICY "Participant rates ride"
ON public.ride_ratings FOR INSERT
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_ratings.ride_id
      AND (
        (r.rider_id = auth.uid() AND r.driver_id = ride_ratings.ratee_id)
        OR (r.driver_id = auth.uid() AND r.rider_id = ride_ratings.ratee_id)
      )
  )
);

-- ============================================================
-- Helper: pending rides for a driver in a radius
-- ============================================================
CREATE OR REPLACE FUNCTION public.pending_rides_for_driver(
  _lat numeric,
  _lng numeric,
  _radius_km numeric DEFAULT 12
)
RETURNS SETOF public.rides
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.* FROM public.rides r
  WHERE r.status IN ('searching', 'offered')
    AND r.driver_id IS NULL
    AND (
      6371 * acos(
        cos(radians(_lat)) * cos(radians(r.pickup_lat))
        * cos(radians(r.pickup_lng) - radians(_lng))
        + sin(radians(_lat)) * sin(radians(r.pickup_lat))
      )
    ) <= _radius_km
  ORDER BY r.created_at DESC
  LIMIT 30;
$$;