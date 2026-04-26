-- Driver profiles: each driver registers once with car photos, plate, contact
CREATE TABLE IF NOT EXISTS public.driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  vehicle_class TEXT NOT NULL DEFAULT 'economy',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  vehicle_year INTEGER,
  vehicle_plate TEXT NOT NULL,
  vehicle_photo TEXT,
  plate_photo TEXT,
  selfie_photo TEXT,
  license_photo TEXT,
  bio TEXT,
  city TEXT,
  country TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  rating NUMERIC NOT NULL DEFAULT 5.0,
  trips INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver profiles public read"
  ON public.driver_profiles FOR SELECT
  USING (active = true);

CREATE POLICY "Owner reads own driver profile"
  ON public.driver_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts own driver profile"
  ON public.driver_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own driver profile"
  ON public.driver_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner deletes own driver profile"
  ON public.driver_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_driver_profiles_updated_at
  BEFORE UPDATE ON public.driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for service media (stays, vehicles, industrial, driver photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-media', 'service-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-media');

CREATE POLICY "Authed users upload service media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'service-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authed users update own service media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'service-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authed users delete own service media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'service-media' AND auth.uid()::text = (storage.foldername(name))[1]);