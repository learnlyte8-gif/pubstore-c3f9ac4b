
-- Escrow / trade assurance on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS escrow_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

-- Quote extensions
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS packaging TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- Quote negotiation thread
CREATE TABLE IF NOT EXISTS public.quote_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  body TEXT,
  proposed_price NUMERIC(12,2),
  proposed_moq INTEGER,
  proposed_packaging TEXT,
  proposed_lead_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quote thread visible to buyer or supplier"
ON public.quote_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.rfqs r ON r.id = q.rfq_id
    WHERE q.id = quote_messages.quote_id
      AND (r.buyer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = q.supplier_id AND s.owner_id = auth.uid()))
  )
);

CREATE POLICY "Buyer or supplier sends quote message"
ON public.quote_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.rfqs r ON r.id = q.rfq_id
    WHERE q.id = quote_messages.quote_id
      AND (r.buyer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = q.supplier_id AND s.owner_id = auth.uid()))
  )
);

CREATE INDEX IF NOT EXISTS idx_quote_messages_quote ON public.quote_messages(quote_id, created_at);

-- Factory inspection reports
CREATE TABLE IF NOT EXISTS public.inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  inspector TEXT,
  report_date DATE,
  document_url TEXT,
  cover_url TEXT,
  summary TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inspection reports are public"
ON public.inspection_reports FOR SELECT USING (true);

CREATE POLICY "Supplier owner manages inspection reports"
ON public.inspection_reports FOR ALL
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = inspection_reports.supplier_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = inspection_reports.supplier_id AND s.owner_id = auth.uid()));

CREATE TRIGGER update_inspection_reports_updated_at
BEFORE UPDATE ON public.inspection_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for inspection report files
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-reports', 'inspection-reports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inspection report files are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-reports');

CREATE POLICY "Auth users upload inspection reports to own folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inspection-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own inspection report files"
ON storage.objects FOR DELETE
USING (bucket_id = 'inspection-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
