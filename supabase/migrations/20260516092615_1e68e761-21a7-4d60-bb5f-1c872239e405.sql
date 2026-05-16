ALTER TABLE public.product_inquiries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID,
  ADD COLUMN IF NOT EXISTS product_title TEXT;

CREATE INDEX IF NOT EXISTS idx_product_inquiries_supplier_status
  ON public.product_inquiries (supplier_id, status, created_at DESC);

DROP POLICY IF EXISTS "Supplier decides inquiry" ON public.product_inquiries;
CREATE POLICY "Supplier decides inquiry"
ON public.product_inquiries
FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = product_inquiries.supplier_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = product_inquiries.supplier_id AND s.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_buyer_on_inquiry_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','declined') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.buyer_id,
      'inquiry_' || NEW.status,
      CASE WHEN NEW.status = 'approved'
        THEN 'Supplier approved your inquiry'
        ELSE 'Supplier declined your inquiry' END,
      CASE WHEN NEW.status = 'approved'
        THEN 'You can now add ' || COALESCE(NEW.product_title, 'the product') || ' to your cart.'
        ELSE 'The supplier declined your request for ' || COALESCE(NEW.product_title, 'this product') || '.' END,
      '/product/' || NEW.product_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_inquiry_decision ON public.product_inquiries;
CREATE TRIGGER trg_notify_inquiry_decision
AFTER UPDATE ON public.product_inquiries
FOR EACH ROW EXECUTE FUNCTION public.notify_buyer_on_inquiry_decision();

ALTER PUBLICATION supabase_realtime ADD TABLE public.product_inquiries;