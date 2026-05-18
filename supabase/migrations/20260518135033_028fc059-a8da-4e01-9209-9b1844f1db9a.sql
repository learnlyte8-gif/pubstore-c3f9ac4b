
-- Separate logistics couriers from ride drivers
CREATE TABLE IF NOT EXISTS public.courier_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  company_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'bike',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  max_weight_kg NUMERIC,
  max_volume_m3 NUMERIC,
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  city TEXT,
  country TEXT,
  base_fee NUMERIC,
  per_km_fee NUMERIC,
  cover_photo TEXT,
  vehicle_photo TEXT,
  plate_photo TEXT,
  selfie_photo TEXT,
  license_photo TEXT,
  insurance_photo TEXT,
  bio TEXT,
  offers_supplier_partnerships BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC NOT NULL DEFAULT 5,
  deliveries_completed INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers viewable by everyone"
  ON public.courier_profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own courier profile"
  ON public.courier_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_courier_profiles_updated
  BEFORE UPDATE ON public.courier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partnership between suppliers and couriers for goods delivery
CREATE TABLE IF NOT EXISTS public.supplier_courier_partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  courier_user_id UUID NOT NULL,
  initiated_by TEXT NOT NULL DEFAULT 'courier', -- 'courier' | 'supplier'
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | declined | paused
  message TEXT,
  agreed_rate NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, courier_user_id)
);

ALTER TABLE public.supplier_courier_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partnerships viewable by participants"
  ON public.supplier_courier_partnerships FOR SELECT USING (
    auth.uid() = courier_user_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );

CREATE POLICY "Couriers create partnership requests"
  ON public.supplier_courier_partnerships FOR INSERT WITH CHECK (auth.uid() = courier_user_id);

CREATE POLICY "Suppliers create partnership requests"
  ON public.supplier_courier_partnerships FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );

CREATE POLICY "Participants update partnership"
  ON public.supplier_courier_partnerships FOR UPDATE USING (
    auth.uid() = courier_user_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );

CREATE POLICY "Participants delete partnership"
  ON public.supplier_courier_partnerships FOR DELETE USING (
    auth.uid() = courier_user_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );

CREATE TRIGGER trg_supplier_courier_partnerships_updated
  BEFORE UPDATE ON public.supplier_courier_partnerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_scp_supplier ON public.supplier_courier_partnerships(supplier_id);
CREATE INDEX IF NOT EXISTS idx_scp_courier ON public.supplier_courier_partnerships(courier_user_id);
