
-- 1) WhatsApp preferences on notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_sales boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_inquiries boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_sandbox_joined boolean NOT NULL DEFAULT false;

-- 2) WhatsApp send log
CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL,
  entity_id text,
  to_phone text NOT NULL,
  body text,
  status text NOT NULL,
  twilio_sid text,
  error text,
  ref_tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;
ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their own wa sends" ON public.whatsapp_send_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS whatsapp_send_log_user_idx ON public.whatsapp_send_log(user_id, created_at DESC);

-- 3) WhatsApp inbound log
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_sid text UNIQUE,
  from_phone text NOT NULL,
  to_phone text,
  body text,
  matched_user_id uuid,
  conversation_id uuid,
  ref_tag text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_inbound_log TO service_role;
ALTER TABLE public.whatsapp_inbound_log ENABLE ROW LEVEL SECURITY;
-- no policies: service role only

-- 4) Dispatch helper: call dispatch-whatsapp-notification edge function via pg_net
CREATE OR REPLACE FUNCTION public._dispatch_whatsapp(event text, entity_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ccprnnqxpnrkdrfsudjc.supabase.co/functions/v1/dispatch-whatsapp-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJubnF4cG5ya2RyZnN1ZGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzY5MzEsImV4cCI6MjA5MjI1MjkzMX0.9Qs_3Bg62d9WIR-29TKXZnQxOkJLEX4YDV72oZZNdGo'
    ),
    body := jsonb_build_object('event', event, 'entity_id', entity_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- never fail the parent transaction because of WA dispatch
  NULL;
END $$;

-- 5) Triggers

-- Orders: new order → fire for buyer + seller
CREATE OR REPLACE FUNCTION public._wa_after_new_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('order_placed', NEW.id::text);
  PERFORM public._dispatch_whatsapp('order_new_sale', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_new_order ON public.orders;
CREATE TRIGGER trg_wa_after_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_new_order();

-- Orders: status change → buyer
CREATE OR REPLACE FUNCTION public._wa_after_order_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._dispatch_whatsapp('order_status', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_order_status ON public.orders;
CREATE TRIGGER trg_wa_after_order_status AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_order_status();

-- Product inquiries: new → supplier owner
CREATE OR REPLACE FUNCTION public._wa_after_product_inquiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('inquiry_new', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_product_inquiry ON public.product_inquiries;
CREATE TRIGGER trg_wa_after_product_inquiry AFTER INSERT ON public.product_inquiries
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_product_inquiry();

CREATE OR REPLACE FUNCTION public._wa_after_inquiry_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','declined') THEN
    PERFORM public._dispatch_whatsapp('inquiry_decision', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_inquiry_decision ON public.product_inquiries;
CREATE TRIGGER trg_wa_after_inquiry_decision AFTER UPDATE ON public.product_inquiries
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_inquiry_decision();

-- Property inquiries
CREATE OR REPLACE FUNCTION public._wa_after_property_inquiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('property_inquiry_new', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_property_inquiry ON public.property_inquiries;
CREATE TRIGGER trg_wa_after_property_inquiry AFTER INSERT ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_property_inquiry();

-- Finance applications
CREATE OR REPLACE FUNCTION public._wa_after_finance_app() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('finance_application_new', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_finance_app ON public.finance_applications;
CREATE TRIGGER trg_wa_after_finance_app AFTER INSERT ON public.finance_applications
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_finance_app();

-- RFQs: buyer confirmation
CREATE OR REPLACE FUNCTION public._wa_after_rfq() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('rfq_submitted', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wa_after_rfq ON public.rfqs;
CREATE TRIGGER trg_wa_after_rfq AFTER INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public._wa_after_rfq();
