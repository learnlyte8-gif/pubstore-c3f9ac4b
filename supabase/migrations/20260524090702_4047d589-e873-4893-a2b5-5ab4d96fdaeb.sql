
-- Stop the test push cron jobs
DO $$ BEGIN
  PERFORM cron.unschedule('push-test-10s') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='push-test-10s');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('push-test-1m') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='push-test-1m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('product-suggestion-1m') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='product-suggestion-1m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Real product suggestion push: pick a random active product per subscribed user
CREATE OR REPLACE FUNCTION public._send_product_suggestions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  uid uuid;
  prod record;
BEGIN
  FOR uid IN SELECT DISTINCT user_id FROM public.push_subscriptions LOOP
    SELECT id, title, price, image, gallery
      INTO prod
      FROM public.products
      WHERE active = true
        AND (image IS NOT NULL OR (gallery IS NOT NULL AND array_length(gallery, 1) > 0))
      ORDER BY random()
      LIMIT 1;
    IF prod.id IS NULL THEN CONTINUE; END IF;

    PERFORM net.http_post(
      url := 'https://ccprnnqxpnrkdrfsudjc.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJubnF4cG5ya2RyZnN1ZGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzY5MzEsImV4cCI6MjA5MjI1MjkzMX0.9Qs_3Bg62d9WIR-29TKXZnQxOkJLEX4YDV72oZZNdGo'
      ),
      body := jsonb_build_object(
        'user_id', uid,
        'title', prod.title,
        'body', 'Trending now · $' || to_char(prod.price, 'FM999990.00'),
        'url', '/product/' || prod.id::text,
        'image', COALESCE(prod.image, prod.gallery[1]),
        'type', 'product_suggestion'
      )
    );
  END LOOP;
END;
$fn$;

-- Schedule every minute
SELECT cron.schedule(
  'product-suggestion-1m',
  '* * * * *',
  $$ SELECT public._send_product_suggestions(); $$
);

-- Drop the old test machinery
DROP FUNCTION IF EXISTS public._push_burst_tick();
DROP FUNCTION IF EXISTS public._send_test_push(text);
DROP TABLE IF EXISTS public._push_test_state;
