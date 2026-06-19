
CREATE OR REPLACE FUNCTION public._dispatch_order_email(event text, order_id text, status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ccprnnqxpnrkdrfsudjc.supabase.co/functions/v1/dispatch-order-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJubnF4cG5ya2RyZnN1ZGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzY5MzEsImV4cCI6MjA5MjI1MjkzMX0.9Qs_3Bg62d9WIR-29TKXZnQxOkJLEX4YDV72oZZNdGo'
    ),
    body := jsonb_build_object('event', event, 'order_id', order_id, 'status', status)
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public._email_after_new_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dispatch_order_email('order_created', NEW.id::text, NEW.status);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_email_after_new_order ON public.orders;
CREATE TRIGGER trg_email_after_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._email_after_new_order();

CREATE OR REPLACE FUNCTION public._email_after_order_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._dispatch_order_email('order_status', NEW.id::text, NEW.status);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_email_after_order_status ON public.orders;
CREATE TRIGGER trg_email_after_order_status AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._email_after_order_status();
