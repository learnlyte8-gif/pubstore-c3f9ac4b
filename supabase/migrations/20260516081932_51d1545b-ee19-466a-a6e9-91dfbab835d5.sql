
-- 1. Certifications table
CREATE TABLE IF NOT EXISTS public.supplier_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuer text,
  document_url text,
  issued_at date,
  expires_at date,
  verified boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_certifications_supplier
  ON public.supplier_certifications(supplier_id);

ALTER TABLE public.supplier_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Certifications public read"
  ON public.supplier_certifications FOR SELECT
  USING (true);

CREATE POLICY "Supplier owner manages certifications"
  ON public.supplier_certifications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_certifications.supplier_id
      AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_certifications.supplier_id
      AND s.owner_id = auth.uid()
  ));

CREATE TRIGGER trg_supplier_certifications_updated_at
  BEFORE UPDATE ON public.supplier_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Product columns: ready_to_ship + lead_time_days
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ready_to_ship boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_time_days integer;

CREATE INDEX IF NOT EXISTS idx_products_ready_to_ship
  ON public.products(ready_to_ship) WHERE ready_to_ship = true;

CREATE INDEX IF NOT EXISTS idx_products_lead_time_days
  ON public.products(lead_time_days);

-- 3. Supplier export countries
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS export_countries text[] NOT NULL DEFAULT '{}';

-- 4. Storage bucket for certification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-certs', 'supplier-certs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Supplier certs public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'supplier-certs');

CREATE POLICY "Supplier owner uploads cert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-certs'
    AND EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Supplier owner deletes cert"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'supplier-certs'
    AND EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Supplier owner updates cert"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'supplier-certs'
    AND EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );
