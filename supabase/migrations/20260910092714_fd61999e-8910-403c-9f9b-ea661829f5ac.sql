-- Server-side function: any supplier on a plan becomes a verified store
CREATE OR REPLACE FUNCTION public._verify_subscribed_supplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.suppliers
     SET verified = true,
         updated_at = now()
   WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_subscribed_supplier ON public.supplier_subscriptions;
CREATE TRIGGER trg_verify_subscribed_supplier
AFTER INSERT OR UPDATE ON public.supplier_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public._verify_subscribed_supplier();

-- Backfill: mark all currently subscribed suppliers as verified
UPDATE public.suppliers s
   SET verified = true,
       updated_at = now()
  FROM public.supplier_subscriptions ss
 WHERE ss.supplier_id = s.id
   AND s.verified IS DISTINCT FROM true;