-- Rides system (inDrive-style fair fare bidding + live tracking)

CREATE TABLE public.rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL,
  driver_id UUID,
  status TEXT NOT NULL DEFAULT 'searching', -- searching | offered | accepted | arriving | in_progress | completed | cancelled
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC NOT NULL,
  pickup_lng NUMERIC NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC NOT NULL,
  dropoff_lng NUMERIC NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  rider_offer NUMERIC NOT NULL, -- rider's proposed fare
  final_fare NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  vehicle_class TEXT NOT NULL DEFAULT 'economy', -- economy | comfort | xl | moto
  notes TEXT,
  rider_lat NUMERIC,
  rider_lng NUMERIC,
  driver_lat NUMERIC,
  driver_lng NUMERIC,
  rider_rating INTEGER,
  driver_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rides_rider ON public.rides(rider_id);
CREATE INDEX idx_rides_driver ON public.rides(driver_id);
CREATE INDEX idx_rides_status ON public.rides(status);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rides public discovery" ON public.rides
  FOR SELECT USING (status IN ('searching', 'offered'));

CREATE POLICY "Participants read ride" ON public.rides
  FOR SELECT USING (auth.uid() = rider_id OR auth.uid() = driver_id);

CREATE POLICY "Rider creates ride" ON public.rides
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Participants update ride" ON public.rides
  FOR UPDATE USING (auth.uid() = rider_id OR auth.uid() = driver_id OR driver_id IS NULL);

-- Driver offers (counter-bids)
CREATE TABLE public.ride_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  driver_name TEXT,
  driver_avatar TEXT,
  driver_rating NUMERIC NOT NULL DEFAULT 4.8,
  driver_trips INTEGER NOT NULL DEFAULT 0,
  vehicle_label TEXT,
  vehicle_plate TEXT,
  fare NUMERIC NOT NULL,
  eta_minutes INTEGER NOT NULL DEFAULT 5,
  driver_lat NUMERIC,
  driver_lng NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | withdrawn
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_offers_ride ON public.ride_offers(ride_id);
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offers visible to ride parties" ON public.ride_offers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND (r.rider_id = auth.uid() OR ride_offers.driver_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND r.status = 'searching')
  );

CREATE POLICY "Drivers post offers" ON public.ride_offers
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers update own offers" ON public.ride_offers
  FOR UPDATE USING (auth.uid() = driver_id OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND r.rider_id = auth.uid()));

-- Live driver locations (for the radar map)
CREATE TABLE public.driver_locations (
  user_id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  vehicle_class TEXT NOT NULL DEFAULT 'economy',
  vehicle_label TEXT,
  rating NUMERIC NOT NULL DEFAULT 4.8,
  online BOOLEAN NOT NULL DEFAULT true,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  heading NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver locations public" ON public.driver_locations
  FOR SELECT USING (online = true);

CREATE POLICY "Driver upserts own location" ON public.driver_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Driver updates own location" ON public.driver_locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Driver deletes own location" ON public.driver_locations
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_offers REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;

-- Seed some demo "ghost" drivers around a few global hotspots so the map feels alive immediately.
-- These are seeded with a synthetic user_id (random UUIDs) so RLS never lets them be modified by real users.
INSERT INTO public.driver_locations (user_id, display_name, vehicle_class, vehicle_label, rating, lat, lng, heading) VALUES
  (gen_random_uuid(), 'Tafadzwa M.', 'economy', 'Toyota Vitz · Silver', 4.92, -17.8252, 31.0335, 45),
  (gen_random_uuid(), 'Rumbi K.',     'comfort', 'Honda Fit · White',   4.88, -17.8290, 31.0410, 120),
  (gen_random_uuid(), 'Brian N.',     'economy', 'Mazda Demio · Blue',  4.81, -17.8211, 31.0460, 220),
  (gen_random_uuid(), 'Linda T.',     'xl',      'Toyota Wish · Black', 4.95, -17.8330, 31.0290, 10),
  (gen_random_uuid(), 'Patrick S.',   'moto',    'Honda CBR · Red',     4.74, -17.8195, 31.0388, 300),
  (gen_random_uuid(), 'Amara O.',     'economy', 'Toyota Aqua · Pearl', 4.90, 6.5244,  3.3792,  60),
  (gen_random_uuid(), 'David K.',     'comfort', 'Hyundai i20 · Grey',  4.86, 6.5300,  3.3850,  140),
  (gen_random_uuid(), 'Joy E.',       'xl',      'Toyota Sienna · Beige', 4.93, 6.5180, 3.3700, 230),
  (gen_random_uuid(), 'Sipho D.',     'economy', 'VW Polo · Red',       4.79, -26.2041, 28.0473, 80),
  (gen_random_uuid(), 'Naledi P.',    'comfort', 'Toyota Corolla · Silver', 4.91, -26.1980, 28.0560, 200),
  (gen_random_uuid(), 'Rahul S.',     'moto',    'Bajaj Pulsar · Blue', 4.83, 28.6139, 77.2090, 15),
  (gen_random_uuid(), 'Priya N.',     'economy', 'Maruti Swift · White', 4.88, 28.6200, 77.2150, 110);