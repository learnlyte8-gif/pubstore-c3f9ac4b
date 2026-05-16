CREATE TABLE public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  product_id uuid not null,
  supplier_id uuid not null,
  message text,
  created_at timestamptz not null default now(),
  unique(buyer_id, product_id)
);

ALTER TABLE public.product_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer creates own inquiry" ON public.product_inquiries
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyer reads own inquiry" ON public.product_inquiries
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = product_inquiries.supplier_id AND s.owner_id = auth.uid())
  );

CREATE INDEX idx_product_inquiries_buyer ON public.product_inquiries(buyer_id, product_id);