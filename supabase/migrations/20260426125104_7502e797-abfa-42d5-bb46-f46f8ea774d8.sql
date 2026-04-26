-- =========================================
-- Multi-vertical "shopping complex" schema
-- =========================================

-- 1) NEWS ARTICLES -------------------------------------------------
CREATE TABLE public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT,
  body TEXT,
  cover TEXT,
  category TEXT NOT NULL DEFAULT 'marketplace',
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  author TEXT,
  source TEXT,
  source_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_minutes INTEGER NOT NULL DEFAULT 3,
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News public read" ON public.news_articles FOR SELECT USING (true);
CREATE TRIGGER trg_news_updated BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_news_published_at ON public.news_articles (published_at DESC);
CREATE INDEX idx_news_category ON public.news_articles (category);

-- 2) STAYS / B&B ---------------------------------------------------
CREATE TABLE public.stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'b&b',          -- b&b | hotel | factory_tour | apartment | retreat
  city TEXT,
  country TEXT,
  country_code TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}'::text[],
  description TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}'::text[],
  bedrooms INTEGER NOT NULL DEFAULT 1,
  beds INTEGER NOT NULL DEFAULT 1,
  baths INTEGER NOT NULL DEFAULT 1,
  guests INTEGER NOT NULL DEFAULT 2,
  price_per_night NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  superhost BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stays public read" ON public.stays FOR SELECT USING (true);
CREATE POLICY "Owner manages stay" ON public.stays
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = stays.supplier_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = stays.supplier_id AND s.owner_id = auth.uid())
  );
CREATE TRIGGER trg_stays_updated BEFORE UPDATE ON public.stays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_stays_country ON public.stays (country);
CREATE INDEX idx_stays_kind ON public.stays (kind);

-- 3) VEHICLES ------------------------------------------------------
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'car',          -- car | truck | bike | ev | parts | accessory
  make TEXT,
  model TEXT,
  year INTEGER,
  condition TEXT NOT NULL DEFAULT 'new',     -- new | used | certified
  fuel TEXT,                                  -- petrol | diesel | electric | hybrid
  transmission TEXT,                          -- manual | automatic
  mileage_km INTEGER,
  body_type TEXT,
  drivetrain TEXT,
  power_hp INTEGER,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}'::text[],
  description TEXT,
  features TEXT[] NOT NULL DEFAULT '{}'::text[],
  city TEXT,
  country TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  badge TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles public read" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Owner manages vehicle" ON public.vehicles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = vehicles.supplier_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = vehicles.supplier_id AND s.owner_id = auth.uid())
  );
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_vehicles_make ON public.vehicles (make);
CREATE INDEX idx_vehicles_kind ON public.vehicles (kind);

-- 4) INDUSTRIAL LISTINGS ------------------------------------------
CREATE TABLE public.industrial_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'machinery', -- machinery | materials | logistics | finance | services | equipment
  subcategory TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}'::text[],
  description TEXT,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  moq INTEGER,
  unit TEXT,
  price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  lead_time TEXT,
  capacity TEXT,
  certifications TEXT[] NOT NULL DEFAULT '{}'::text[],
  ship_from TEXT,
  country TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.industrial_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Industrial public read" ON public.industrial_listings FOR SELECT USING (true);
CREATE POLICY "Owner manages industrial" ON public.industrial_listings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = industrial_listings.supplier_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = industrial_listings.supplier_id AND s.owner_id = auth.uid())
  );
CREATE TRIGGER trg_industrial_updated BEFORE UPDATE ON public.industrial_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_industrial_category ON public.industrial_listings (category);