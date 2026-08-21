CREATE OR REPLACE FUNCTION public.dispatch_notification_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._dispatch_whatsapp('generic_notification', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_whatsapp ON public.notifications;
CREATE TRIGGER trg_notifications_whatsapp
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_whatsapp();