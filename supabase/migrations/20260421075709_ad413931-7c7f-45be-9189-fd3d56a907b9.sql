
-- =========================================================
-- 1. Notification preferences (per user, per channel × type)
-- =========================================================
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- In-app channel
  inapp_followed_supplier_new_product BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_followed_supplier_live BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_orders BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_messages BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_rfq BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_wishlist_price_drop BOOLEAN NOT NULL DEFAULT TRUE,
  inapp_wishlist_restock BOOLEAN NOT NULL DEFAULT TRUE,

  -- Web Push channel
  push_followed_supplier_new_product BOOLEAN NOT NULL DEFAULT TRUE,
  push_followed_supplier_live BOOLEAN NOT NULL DEFAULT TRUE,
  push_orders BOOLEAN NOT NULL DEFAULT TRUE,
  push_messages BOOLEAN NOT NULL DEFAULT TRUE,
  push_rfq BOOLEAN NOT NULL DEFAULT TRUE,
  push_wishlist_price_drop BOOLEAN NOT NULL DEFAULT TRUE,
  push_wishlist_restock BOOLEAN NOT NULL DEFAULT TRUE,

  -- Email channel
  email_welcome BOOLEAN NOT NULL DEFAULT TRUE,
  email_onboarding BOOLEAN NOT NULL DEFAULT TRUE,
  email_new_product_followed BOOLEAN NOT NULL DEFAULT TRUE,
  email_orders BOOLEAN NOT NULL DEFAULT TRUE,
  email_rfq BOOLEAN NOT NULL DEFAULT TRUE,
  email_weekly_digest BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own prefs select" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own prefs insert" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own prefs update" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create preferences row on signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill prefs for existing users
INSERT INTO public.notification_preferences (user_id)
  SELECT user_id FROM public.profiles
  ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- 2. Web Push subscriptions
-- =========================================================
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, DELETE, UPDATE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own push subs select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own push subs insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own push subs delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- =========================================================
-- 3. Weekly digest log (idempotency)
-- =========================================================
CREATE TABLE public.weekly_digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  product_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, week_start)
);

GRANT SELECT ON public.weekly_digest_log TO authenticated;
GRANT ALL ON public.weekly_digest_log TO service_role;

ALTER TABLE public.weekly_digest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own digest log select" ON public.weekly_digest_log
  FOR SELECT USING (auth.uid() = user_id);

-- =========================================================
-- 4. TRIGGERS that populate public.notifications
-- =========================================================

-- 4a. New product from a supplier I follow
CREATE OR REPLACE FUNCTION public.notify_followers_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s_name TEXT;
BEGIN
  SELECT name INTO s_name FROM public.suppliers WHERE id = NEW.supplier_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    f.user_id,
    'follower_new_product',
    COALESCE(s_name, 'A supplier you follow') || ' just listed something new',
    NEW.title,
    '/product/' || NEW.id
  FROM public.followers f
  LEFT JOIN public.notification_preferences np ON np.user_id = f.user_id
  WHERE f.supplier_id = NEW.supplier_id
    AND COALESCE(np.inapp_followed_supplier_new_product, TRUE) = TRUE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_notify_followers
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_new_product();

-- 4b. Followed supplier went live
CREATE OR REPLACE FUNCTION public.notify_followers_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s_name TEXT;
BEGIN
  IF NEW.status <> 'live' THEN RETURN NEW; END IF;
  SELECT name INTO s_name FROM public.suppliers WHERE id = NEW.supplier_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    f.user_id,
    'follower_live',
    COALESCE(s_name, 'A supplier you follow') || ' is live now',
    NEW.title,
    '/live/' || NEW.id
  FROM public.followers f
  LEFT JOIN public.notification_preferences np ON np.user_id = f.user_id
  WHERE f.supplier_id = NEW.supplier_id
    AND COALESCE(np.inapp_followed_supplier_live, TRUE) = TRUE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER live_streams_notify_followers
  AFTER INSERT ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_live();

-- 4c. Wishlist price drop (>= 10% reduction in price)
CREATE OR REPLACE FUNCTION public.notify_wishlist_price_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  drop_pct NUMERIC;
BEGIN
  IF NEW.price >= OLD.price OR OLD.price = 0 THEN RETURN NEW; END IF;
  drop_pct := (OLD.price - NEW.price) / OLD.price;
  IF drop_pct < 0.10 THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    w.user_id,
    'price',
    'Price drop on a wishlist item',
    NEW.title || ' is now $' || ROUND(NEW.price::numeric, 2) ||
      ' (was $' || ROUND(OLD.price::numeric, 2) || ')',
    '/product/' || NEW.id
  FROM public.wishlist_items w
  LEFT JOIN public.notification_preferences np ON np.user_id = w.user_id
  WHERE w.product_id = NEW.id
    AND COALESCE(np.inapp_wishlist_price_drop, TRUE) = TRUE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_price_drop_notify
  AFTER UPDATE OF price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_price_drop();

-- 4d. Wishlist restock (active false -> true)
CREATE OR REPLACE FUNCTION public.notify_wishlist_restock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.active, FALSE) = TRUE OR COALESCE(NEW.active, FALSE) = FALSE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    w.user_id,
    'restock',
    'Back in stock',
    NEW.title || ' is available again',
    '/product/' || NEW.id
  FROM public.wishlist_items w
  LEFT JOIN public.notification_preferences np ON np.user_id = w.user_id
  WHERE w.product_id = NEW.id
    AND COALESCE(np.inapp_wishlist_restock, TRUE) = TRUE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_restock_notify
  AFTER UPDATE OF active ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_restock();

-- 4e. New order placed -> notify buyer + supplier owner
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner_uid UUID;
  s_name TEXT;
BEGIN
  SELECT owner_id, name INTO owner_uid, s_name FROM public.suppliers WHERE id = NEW.supplier_id;

  -- buyer notification
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT NEW.buyer_id, 'order_placed',
    'Order placed with ' || COALESCE(s_name, 'supplier'),
    'Reference ' || COALESCE(NEW.ref_code, NEW.id::text),
    '/orders'
  WHERE EXISTS (
    SELECT 1 FROM public.notification_preferences np
    WHERE np.user_id = NEW.buyer_id AND np.inapp_orders = TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.notification_preferences WHERE user_id = NEW.buyer_id
  );

  -- supplier notification
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'new_order',
      'New order received',
      'Reference ' || COALESCE(NEW.ref_code, NEW.id::text),
      '/orders');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_notify_new
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- 4f. Order status change
CREATE OR REPLACE FUNCTION public.notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.buyer_id,
    'order_status',
    'Order ' || COALESCE(NEW.ref_code, NEW.id::text) || ' is now ' || NEW.status,
    CASE NEW.status::text
      WHEN 'shipped' THEN 'Tracking will be available soon'
      WHEN 'delivered' THEN 'Mark as received and leave a review'
      ELSE NULL
    END,
    '/orders'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_notify_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

-- 4g. New chat message -> notify the other party
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  buyer_uid UUID;
  supplier_uid UUID;
  recipient_uid UUID;
BEGIN
  SELECT c.buyer_id, s.owner_id
    INTO buyer_uid, supplier_uid
    FROM public.conversations c
    JOIN public.suppliers s ON s.id = c.supplier_id
    WHERE c.id = NEW.conversation_id;

  recipient_uid := CASE WHEN NEW.sender_id = buyer_uid THEN supplier_uid ELSE buyer_uid END;
  IF recipient_uid IS NULL OR recipient_uid = NEW.sender_id THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    recipient_uid,
    'message',
    'New message',
    LEFT(NEW.body, 120),
    '/messages'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 4h. New quote on an RFQ -> notify the buyer
CREATE OR REPLACE FUNCTION public.notify_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  buyer_uid UUID;
  rfq_title TEXT;
  s_name TEXT;
BEGIN
  SELECT r.buyer_id, r.title INTO buyer_uid, rfq_title
    FROM public.rfqs r WHERE r.id = NEW.rfq_id;
  SELECT name INTO s_name FROM public.suppliers WHERE id = NEW.supplier_id;
  IF buyer_uid IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    buyer_uid,
    'rfq_quote',
    'New quote on “' || COALESCE(rfq_title, 'your RFQ') || '”',
    COALESCE(s_name, 'A supplier') || ' quoted $' || ROUND(NEW.price_per_unit::numeric, 2),
    '/rfq'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER quotes_notify
  AFTER INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_quote();

-- =========================================================
-- 5. Realtime: ensure notifications stream to clients
-- =========================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
