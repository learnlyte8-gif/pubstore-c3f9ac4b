
CREATE TABLE public.agro_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'produce',
  subcategory TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}'::text[],
  description TEXT,
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  moq INTEGER,
  unit TEXT,
  price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  harvest_season TEXT,
  lead_time TEXT,
  capacity TEXT,
  certifications TEXT[] NOT NULL DEFAULT '{}'::text[],
  organic BOOLEAN NOT NULL DEFAULT false,
  ship_from TEXT,
  country TEXT,
  region TEXT,
  funding_goal NUMERIC,
  funding_raised NUMERIC DEFAULT 0,
  project_status TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agro_kind ON public.agro_listings(kind);
CREATE INDEX idx_agro_featured ON public.agro_listings(featured);

ALTER TABLE public.agro_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agro public read" ON public.agro_listings FOR SELECT USING (true);

CREATE POLICY "Owner manages agro" ON public.agro_listings
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = agro_listings.supplier_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = agro_listings.supplier_id AND s.owner_id = auth.uid()));

CREATE TRIGGER update_agro_listings_updated_at
  BEFORE UPDATE ON public.agro_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data
INSERT INTO public.agro_listings (title, kind, subcategory, cover, description, spec, moq, unit, price, harvest_season, lead_time, capacity, certifications, organic, ship_from, country, region, featured) VALUES
('Premium Arabica Green Coffee Beans', 'produce', 'coffee', 'https://images.unsplash.com/photo-1559525839-d9acfd732c2a?w=800', 'Single-origin Arabica beans, washed processed, screen size 16+. Direct from highland cooperatives.', '{"grade":"AA","moisture":"11%","screen":"16+","cup_score":"86"}'::jsonb, 500, 'kg', 4.80, 'May–Sep', '2–3 weeks', '40 tons / harvest', ARRAY['Organic','Fair Trade','Rainforest Alliance'], true, 'Addis Ababa', 'Ethiopia', 'East Africa', true),
('Cavendish Bananas — Export Grade', 'produce', 'fruit', 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800', 'Class I Cavendish bananas, cold chain shipped in 18.14kg cartons.', '{"length":"20cm+","cartons_per_pallet":"54","temperature":"13.3°C"}'::jsonb, 1, 'container', 11500, 'Year-round', '7–10 days', '12 containers/wk', ARRAY['GlobalG.A.P.','HACCP'], false, 'Guayaquil', 'Ecuador', 'South America', true),
('Premium Hass Avocados', 'produce', 'fruit', 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=800', 'Calibre 16–22, picked at 23% dry matter. Sea freight ready.', '{"calibre":"16-22","dry_matter":"23%","brix":"7.5"}'::jsonb, 500, 'kg', 2.40, 'Apr–Sep', '10–14 days', '60 tons/wk', ARRAY['GlobalG.A.P.','SMETA'], false, 'Nairobi', 'Kenya', 'East Africa', false),
('White Maize — Grade 1', 'produce', 'grains', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800', 'Non-GMO white maize, 13.5% moisture, aflatoxin tested.', '{"moisture":"13.5%","foreign_matter":"<1%","broken":"<2%"}'::jsonb, 25, 'ton', 305, 'Apr–Jun', '14 days', '5000 tons', ARRAY['Non-GMO'], false, 'Lusaka', 'Zambia', 'Southern Africa', false),
('Compact Tractor 35HP — 4WD', 'equipment', 'machinery', 'https://images.unsplash.com/photo-1605338803155-8b6f1c5f17b6?w=800', 'Reliable 35HP tractor with PTO, hydraulic lift, 3-point hitch. Ideal for smallholder farms.', '{"engine":"35HP diesel","drive":"4WD","pto":"540rpm","lift":"900kg"}'::jsonb, 1, 'unit', 8950, NULL, '21 days', '120 units/mo', ARRAY['CE','ISO 9001'], false, 'Pune', 'India', 'South Asia', true),
('Solar-Powered Drip Irrigation Kit (1 ha)', 'equipment', 'irrigation', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', 'Complete 1-hectare drip irrigation system with 320W solar panel, pump, filters and 6000m of dripline.', '{"area":"1 ha","flow":"3.5 m³/h","pressure":"2 bar","solar":"320W"}'::jsonb, 1, 'kit', 1480, NULL, '10 days', '800 kits/mo', ARRAY['ISO 9001'], false, 'Shenzhen', 'China', 'Asia', false),
('NPK 15-15-15 Compound Fertilizer', 'inputs', 'fertilizer', 'https://images.unsplash.com/photo-1592982537447-7440770faae9?w=800', 'Balanced NPK granular fertilizer, 50kg bags, palletized.', '{"N":"15%","P":"15%","K":"15%","granulation":"2-4mm"}'::jsonb, 25, 'ton', 520, NULL, '14 days', '20000 tons', ARRAY['ISO 9001'], false, 'Casablanca', 'Morocco', 'North Africa', false),
('Certified Hybrid Maize Seed SC403', 'inputs', 'seed', 'https://images.unsplash.com/photo-1530507629858-e3759c2c52ae?w=800', 'Early-maturing drought-tolerant hybrid, 110-day cycle, 8–10 t/ha potential yield.', '{"maturity":"110 days","yield_potential":"8-10 t/ha","germination":"95%"}'::jsonb, 100, 'kg', 4.50, 'Pre-season', '7 days', '500 tons', ARRAY['ISTA Certified'], false, 'Harare', 'Zimbabwe', 'Southern Africa', false),
('Boer Goat Breeding Pair', 'livestock', 'goat', 'https://images.unsplash.com/photo-1533318087102-b3ad366ed041?w=800', 'Pure-bred Boer breeding pair, dewormed, vaccinated, papers included.', '{"breed":"Boer","age":"12-18mo","weight":"45-55kg"}'::jsonb, 1, 'pair', 850, NULL, 'Live transport', '30 pairs/mo', ARRAY['Vet Certified'], false, 'Bloemfontein', 'South Africa', 'Southern Africa', false),
('Day-Old Broiler Chicks (Cobb 500)', 'livestock', 'poultry', 'https://images.unsplash.com/photo-1612170153139-6f881ff067e0?w=800', 'Vaccinated Cobb 500 day-old broiler chicks, FCR 1.55, 42-day cycle.', '{"breed":"Cobb 500","fcr":"1.55","cycle":"42 days"}'::jsonb, 500, 'chick', 0.85, 'Year-round', '3–5 days', '200k chicks/wk', ARRAY['NPIP'], false, 'Nairobi', 'Kenya', 'East Africa', false),
('Cold Chain Logistics — Reefer Container', 'services', 'logistics', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800', '40ft reefer container service, -25°C to +25°C, GPS tracked, end-to-end cold chain.', '{"size":"40ft","temp_range":"-25 to +25C","tracking":"GPS"}'::jsonb, 1, 'container', 4200, NULL, 'On demand', 'Global', ARRAY['IICL','HACCP'], false, 'Durban', 'South Africa', 'Global', false),
('Agronomy Advisory & Soil Testing', 'services', 'advisory', 'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=800', 'Field agronomy package: soil analysis, nutrient plan, monthly visits, satellite NDVI monitoring.', '{"visits":"monthly","reports":"digital","soil_tests":"3/season"}'::jsonb, 1, 'ha/season', 95, NULL, '7 days', NULL, ARRAY['ISO 17025 lab'], false, 'Kampala', 'Uganda', 'East Africa', false),
('Smallholder Maize Outgrower Program', 'project', 'outgrower', 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800', 'Funding 250 smallholder farmers across 500ha. Inputs, training, guaranteed offtake. 14% projected IRR.', '{"farmers":"250","hectares":"500","irr":"14%","tenor":"18mo"}'::jsonb, NULL, NULL, NULL, 'Oct planting', NULL, '500 ha', ARRAY['Verified by KPMG'], false, 'Lilongwe', 'Malawi', 'Southern Africa', true),
('Greenhouse Tomato Expansion — 5 ha', 'project', 'greenhouse', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800', 'Expansion of certified greenhouse complex by 5ha. Drip + climate control. 18-month payback.', '{"area":"5 ha","yield":"550 t/yr","irr":"22%","tenor":"36mo"}'::jsonb, NULL, NULL, NULL, NULL, NULL, '550 t/yr', ARRAY['GlobalG.A.P.'], false, 'Marrakech', 'Morocco', 'North Africa', true),
('Cassava Processing Plant Co-Investment', 'project', 'processing', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800', 'Co-invest in a 20 tpd cassava starch processing plant. Off-take secured with two food majors.', '{"throughput":"20 tpd","offtake":"signed","irr":"19%","tenor":"48mo"}'::jsonb, NULL, NULL, NULL, NULL, NULL, '20 tpd', ARRAY['HACCP','ISO 22000'], false, 'Ibadan', 'Nigeria', 'West Africa', false);

UPDATE public.agro_listings SET funding_goal = 750000, funding_raised = 215000, project_status = 'open' WHERE kind = 'project' AND subcategory = 'outgrower';
UPDATE public.agro_listings SET funding_goal = 1200000, funding_raised = 480000, project_status = 'open' WHERE kind = 'project' AND subcategory = 'greenhouse';
UPDATE public.agro_listings SET funding_goal = 2400000, funding_raised = 350000, project_status = 'open' WHERE kind = 'project' AND subcategory = 'processing';
