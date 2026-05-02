-- Car rental listings
CREATE TABLE public.car_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  supplier_id UUID,
  -- Vehicle
  title TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  vehicle_class TEXT NOT NULL DEFAULT 'economy', -- economy | suv | luxury | van | bakkie | ev | exotic
  body_type TEXT,
  transmission TEXT NOT NULL DEFAULT 'automatic', -- automatic | manual
  fuel TEXT NOT NULL DEFAULT 'petrol',
  seats INTEGER NOT NULL DEFAULT 5,
  doors INTEGER,
  luggage INTEGER, -- bag count
  ac BOOLEAN NOT NULL DEFAULT TRUE,
  features TEXT[] NOT NULL DEFAULT '{}',
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  -- Pricing
  price_per_day NUMERIC NOT NULL,
  price_per_week NUMERIC,
  price_per_month NUMERIC,
  weekend_surcharge_pct NUMERIC, -- e.g. 15 means +15% on Sat/Sun
  currency TEXT NOT NULL DEFAULT 'USD',
  deposit NUMERIC NOT NULL DEFAULT 0,
  -- Mileage
  free_km_per_day INTEGER NOT NULL DEFAULT 200,
  unlimited_km BOOLEAN NOT NULL DEFAULT FALSE,
  extra_km_fee NUMERIC, -- per km
  -- Eligibility
  min_age INTEGER NOT NULL DEFAULT 21,
  max_age INTEGER,
  min_license_years INTEGER NOT NULL DEFAULT 1,
  young_driver_fee NUMERIC, -- per day if under threshold
  young_driver_age_threshold INTEGER, -- e.g. 25
  required_documents TEXT[] NOT NULL DEFAULT '{}', -- e.g. {national_id, drivers_license, proof_of_address}
  international_license_ok BOOLEAN NOT NULL DEFAULT TRUE,
  cross_border_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  cross_border_fee NUMERIC,
  cross_border_countries TEXT[] NOT NULL DEFAULT '{}',
  -- Booking constraints
  min_rental_days INTEGER NOT NULL DEFAULT 1,
  max_rental_days INTEGER,
  advance_booking_hours INTEGER NOT NULL DEFAULT 4,
  pickup_locations TEXT[] NOT NULL DEFAULT '{}',
  delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_fee NUMERIC,
  fuel_policy TEXT NOT NULL DEFAULT 'full_to_full', -- full_to_full | prepaid | same_level
  smoking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  pets_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  -- Penalties (structured but flexible)
  late_return_fee_per_hour NUMERIC,
  cleaning_fee NUMERIC,
  smoking_penalty NUMERIC,
  pet_penalty NUMERIC,
  damage_excess NUMERIC, -- insurance excess
  cancellation_policy TEXT NOT NULL DEFAULT 'flexible', -- flexible | moderate | strict
  cancellation_fee NUMERIC,
  custom_rules TEXT[] NOT NULL DEFAULT '{}', -- free-form extra rules
  custom_penalties JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{label, amount, currency}]
  -- Insurance
  insurance_included BOOLEAN NOT NULL DEFAULT TRUE,
  insurance_provider TEXT,
  insurance_options JSONB NOT NULL DEFAULT '[]'::jsonb, -- upgrade tiers
  -- Location & contact
  city TEXT,
  country TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  -- Status
  rating NUMERIC NOT NULL DEFAULT 0,
  trips_completed INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_car_rentals_active ON public.car_rentals(active);
CREATE INDEX idx_car_rentals_owner ON public.car_rentals(owner_user_id);
CREATE INDEX idx_car_rentals_class ON public.car_rentals(vehicle_class);

ALTER TABLE public.car_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Car rentals public read"
  ON public.car_rentals FOR SELECT
  USING (active = TRUE OR auth.uid() = owner_user_id);

CREATE POLICY "Owner manages car rental"
  ON public.car_rentals FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER update_car_rentals_updated_at
  BEFORE UPDATE ON public.car_rentals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Booking requests
CREATE TABLE public.car_rental_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL,
  renter_id UUID NOT NULL,
  renter_name TEXT,
  renter_phone TEXT,
  renter_email TEXT,
  renter_age INTEGER,
  license_years INTEGER,
  pickup_at TIMESTAMP WITH TIME ZONE NOT NULL,
  return_at TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_location TEXT,
  dropoff_location TEXT,
  delivery_requested BOOLEAN NOT NULL DEFAULT FALSE,
  expected_km INTEGER,
  cross_border BOOLEAN NOT NULL DEFAULT FALSE,
  cross_border_destination TEXT,
  notes TEXT,
  estimated_total NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | declined | cancelled | completed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.car_rental_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Renter creates booking"
  ON public.car_rental_bookings FOR INSERT
  WITH CHECK (auth.uid() = renter_id);

CREATE POLICY "Booking parties read"
  ON public.car_rental_bookings FOR SELECT
  USING (
    auth.uid() = renter_id
    OR EXISTS (SELECT 1 FROM public.car_rentals r WHERE r.id = car_rental_bookings.rental_id AND r.owner_user_id = auth.uid())
  );

CREATE POLICY "Booking parties update"
  ON public.car_rental_bookings FOR UPDATE
  USING (
    auth.uid() = renter_id
    OR EXISTS (SELECT 1 FROM public.car_rentals r WHERE r.id = car_rental_bookings.rental_id AND r.owner_user_id = auth.uid())
  );

CREATE TRIGGER update_car_rental_bookings_updated_at
  BEFORE UPDATE ON public.car_rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();