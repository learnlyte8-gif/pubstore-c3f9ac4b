CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tracker for when the burst test started
CREATE TABLE IF NOT EXISTS public._push_test_state (
  id int PRIMARY KEY DEFAULT 1,
  burst_started_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
TRUNCATE public._push_test_state;
INSERT INTO public._push_test_state (id, burst_started_at) VALUES (1, now());

-- Function: send one test push to every user with a subscription
CREATE OR REPLACE FUNCTION public._send_test_push(_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  FOR uid IN SELECT DISTINCT user_id FROM public.push_subscriptions LOOP
    PERFORM net.http_post(
      url := 'https://ccprnnqxpnrkdrfsudjc.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJubnF4cG5ya2RyZnN1ZGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzY5MzEsImV4cCI6MjA5MjI1MjkzMX0.9Qs_3Bg62d9WIR-29TKXZnQxOkJLEX4YDV72oZZNdGo'
      ),
      body := jsonb_build_object(
        'user_id', uid,
        'title', 'PUBSTORE test push',
        'body', _label || ' · ' || to_char(now() AT TIME ZONE 'UTC', 'HH24:MI:SS') || ' UTC',
        'url', '/home',
        'type', 'test'
      )
    );
  END LOOP;
END;
$$;

-- Burst job: every 10 seconds, but auto-stops after 60s
CREATE OR REPLACE FUNCTION public._push_burst_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  started timestamptz;
BEGIN
  SELECT burst_started_at INTO started FROM public._push_test_state WHERE id = 1;
  IF started IS NULL OR now() - started > interval '70 seconds' THEN
    PERFORM cron.unschedule('push-test-10s');
    RETURN;
  END IF;
  PERFORM public._send_test_push('10s burst');
END;
$$;

-- Clean up any prior schedules with these names
DO $$
BEGIN
  PERFORM cron.unschedule('push-test-10s') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='push-test-10s');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('push-test-1m') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='push-test-1m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Every 10 seconds (pg_cron sub-minute syntax)
SELECT cron.schedule('push-test-10s', '10 seconds', $$ SELECT public._push_burst_tick(); $$);

-- Every minute, forever (until you unschedule it)
SELECT cron.schedule('push-test-1m', '* * * * *', $$ SELECT public._send_test_push('1m heartbeat'); $$);