-- Guard: only the buyer confirmation RPC may set status = 'delivered'
CREATE OR REPLACE FUNCTION public._orders_block_premature_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'delivered'
     AND COALESCE(OLD.status::text, '') <> 'delivered'
     AND NEW.buyer_confirmed_delivered_at IS NULL THEN
    -- Treat it as a seller delivery mark instead of a completed delivery.
    NEW.status := 'shipped'::order_status;
    NEW.supplier_marked_delivered_at := COALESCE(NEW.supplier_marked_delivered_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_block_premature_delivered ON public.orders;
CREATE TRIGGER trg_orders_block_premature_delivered
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._orders_block_premature_delivered();

-- Repair rows already marked delivered without buyer confirmation
UPDATE public.orders
SET status = 'shipped'::order_status,
    supplier_marked_delivered_at = COALESCE(supplier_marked_delivered_at, now()),
    updated_at = now()
WHERE status::text = 'delivered'
  AND buyer_confirmed_delivered_at IS NULL;