
-- =============== LOCAL SERVICES ===============
CREATE TABLE public.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL, -- plumber, electrician, tutor, photographer, etc.
  subcategory TEXT,
  bio TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  service_area TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC NOT NULL DEFAULT 5.0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service providers public read" ON public.service_providers FOR SELECT USING (active = true);
CREATE POLICY "Owner reads own provider" ON public.service_providers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner inserts own provider" ON public.service_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own provider" ON public.service_providers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner deletes own provider" ON public.service_providers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_service_providers_updated BEFORE UPDATE ON public.service_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  budget NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  deadline DATE,
  city TEXT,
  country TEXT,
  address TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open', -- open, assigned, completed, cancelled
  assigned_provider_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service requests public read open" ON public.service_requests FOR SELECT USING (status = 'open' OR auth.uid() = buyer_id);
CREATE POLICY "Buyer creates request" ON public.service_requests FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyer updates request" ON public.service_requests FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY "Buyer deletes request" ON public.service_requests FOR DELETE USING (auth.uid() = buyer_id);
CREATE TRIGGER trg_service_requests_updated BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  provider_user_id UUID NOT NULL,
  provider_name TEXT,
  provider_avatar TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  eta_days INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bids visible to request owner and bidder" ON public.service_bids FOR SELECT USING (
  auth.uid() = provider_user_id OR EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = service_bids.request_id AND r.buyer_id = auth.uid())
);
CREATE POLICY "Provider creates bid" ON public.service_bids FOR INSERT WITH CHECK (auth.uid() = provider_user_id);
CREATE POLICY "Bid parties update" ON public.service_bids FOR UPDATE USING (
  auth.uid() = provider_user_id OR EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = service_bids.request_id AND r.buyer_id = auth.uid())
);

-- =============== REAL ESTATE ===============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  listing_type TEXT NOT NULL DEFAULT 'rent', -- rent, sale, shared
  property_kind TEXT NOT NULL DEFAULT 'apartment', -- apartment, house, land, commercial, room
  bedrooms INTEGER,
  baths INTEGER,
  area_sqm NUMERIC,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_period TEXT DEFAULT 'month', -- month, year, total
  city TEXT,
  country TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  virtual_tour_url TEXT,
  furnished BOOLEAN NOT NULL DEFAULT false,
  available_from DATE,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Properties public read" ON public.properties FOR SELECT USING (active = true OR auth.uid() = owner_user_id);
CREATE POLICY "Owner manages property" ON public.properties FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.property_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  inquirer_id UUID NOT NULL,
  inquirer_name TEXT,
  inquirer_phone TEXT,
  inquirer_email TEXT,
  message TEXT,
  preferred_date DATE,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inquiry parties read" ON public.property_inquiries FOR SELECT USING (
  auth.uid() = inquirer_id OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_inquiries.property_id AND p.owner_user_id = auth.uid())
);
CREATE POLICY "User creates inquiry" ON public.property_inquiries FOR INSERT WITH CHECK (auth.uid() = inquirer_id);

-- =============== LOGISTICS ===============
CREATE TABLE public.logistics_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC,
  pickup_lng NUMERIC,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC,
  dropoff_lng NUMERIC,
  distance_km NUMERIC,
  weight_kg NUMERIC,
  package_kind TEXT, -- documents, parcel, furniture, freight
  vehicle_type TEXT NOT NULL DEFAULT 'bike', -- bike, car, van, truck
  budget NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  pickup_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_driver_id UUID,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logistics public read open" ON public.logistics_requests FOR SELECT USING (status = 'open' OR auth.uid() = buyer_id OR auth.uid() = assigned_driver_id);
CREATE POLICY "Buyer creates logistics" ON public.logistics_requests FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Logistics parties update" ON public.logistics_requests FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = assigned_driver_id);
CREATE POLICY "Buyer deletes logistics" ON public.logistics_requests FOR DELETE USING (auth.uid() = buyer_id);
CREATE TRIGGER trg_logistics_requests_updated BEFORE UPDATE ON public.logistics_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.logistics_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  driver_name TEXT,
  driver_avatar TEXT,
  driver_rating NUMERIC NOT NULL DEFAULT 4.8,
  vehicle_label TEXT,
  vehicle_plate TEXT,
  fare NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  eta_minutes INTEGER NOT NULL DEFAULT 15,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logistics bids visible parties" ON public.logistics_bids FOR SELECT USING (
  auth.uid() = driver_id OR EXISTS (SELECT 1 FROM public.logistics_requests r WHERE r.id = logistics_bids.request_id AND r.buyer_id = auth.uid())
);
CREATE POLICY "Driver creates logistics bid" ON public.logistics_bids FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Logistics bid parties update" ON public.logistics_bids FOR UPDATE USING (
  auth.uid() = driver_id OR EXISTS (SELECT 1 FROM public.logistics_requests r WHERE r.id = logistics_bids.request_id AND r.buyer_id = auth.uid())
);

-- =============== FINANCE ===============
CREATE TABLE public.finance_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL, -- loan, vehicle_financing, insurance, working_capital
  provider_name TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  min_amount NUMERIC,
  max_amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  interest_rate NUMERIC, -- annual %
  term_months INTEGER,
  requirements TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  country TEXT,
  city TEXT,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance products public read" ON public.finance_products FOR SELECT USING (active = true OR auth.uid() = owner_user_id);
CREATE POLICY "Owner manages finance product" ON public.finance_products FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE TRIGGER trg_finance_products_updated BEFORE UPDATE ON public.finance_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  applicant_name TEXT,
  applicant_phone TEXT,
  applicant_email TEXT,
  amount_requested NUMERIC,
  term_months INTEGER,
  purpose TEXT,
  monthly_income NUMERIC,
  employment_status TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance app parties read" ON public.finance_applications FOR SELECT USING (
  auth.uid() = applicant_id OR EXISTS (SELECT 1 FROM public.finance_products p WHERE p.id = finance_applications.product_id AND p.owner_user_id = auth.uid())
);
CREATE POLICY "Applicant creates app" ON public.finance_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Finance app parties update" ON public.finance_applications FOR UPDATE USING (
  auth.uid() = applicant_id OR EXISTS (SELECT 1 FROM public.finance_products p WHERE p.id = finance_applications.product_id AND p.owner_user_id = auth.uid())
);
CREATE TRIGGER trg_finance_apps_updated BEFORE UPDATE ON public.finance_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_service_providers_category ON public.service_providers(category) WHERE active = true;
CREATE INDEX idx_service_providers_user ON public.service_providers(user_id);
CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_bids_request ON public.service_bids(request_id);
CREATE INDEX idx_properties_listing_type ON public.properties(listing_type) WHERE active = true;
CREATE INDEX idx_properties_owner ON public.properties(owner_user_id);
CREATE INDEX idx_property_inquiries_property ON public.property_inquiries(property_id);
CREATE INDEX idx_logistics_status ON public.logistics_requests(status);
CREATE INDEX idx_logistics_bids_request ON public.logistics_bids(request_id);
CREATE INDEX idx_finance_products_kind ON public.finance_products(kind) WHERE active = true;
CREATE INDEX idx_finance_apps_product ON public.finance_applications(product_id);
