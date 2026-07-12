
-- Expo push tokens
CREATE TABLE IF NOT EXISTS public.expo_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expo_push_tokens TO authenticated;
GRANT ALL ON public.expo_push_tokens TO service_role;

ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.expo_push_tokens;
CREATE POLICY "Users can manage own push tokens"
  ON public.expo_push_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_expo_push_tokens_updated_at
  BEFORE UPDATE ON public.expo_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Peer insert policy on notifications (for chat)
DROP POLICY IF EXISTS "Users can insert peer notifications" ON public.notifications;
CREATE POLICY "Users can insert peer notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IS NOT NULL
    AND user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.owner_id = auth.uid()))
    )
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = user_id OR c.supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.owner_id = user_id))
    )
  );

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='expo_push_tokens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expo_push_tokens;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Expo push trigger via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.send_expo_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  t record;
  payload jsonb;
BEGIN
  FOR t IN SELECT token FROM public.expo_push_tokens WHERE user_id = NEW.user_id LOOP
    payload := jsonb_build_object(
      'to', t.token,
      'title', NEW.title,
      'body', NEW.body,
      'data', jsonb_build_object('link', NEW.link, 'type', NEW.type),
      'sound', 'default',
      'priority', 'high'
    );
    PERFORM extensions.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_notification_expo_push ON public.notifications;
CREATE TRIGGER on_new_notification_expo_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_expo_push_on_notification();
