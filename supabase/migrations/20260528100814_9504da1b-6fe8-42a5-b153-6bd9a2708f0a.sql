
-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-media', 'restaurant-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Restaurant media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-media');

CREATE POLICY "Users upload own restaurant media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurant-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own restaurant media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurant-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own restaurant media"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow uploading video files to existing buckets too (no schema change needed)

-- ============ RESTAURANTS ============
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  cuisine TEXT,
  description TEXT,
  cover TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  city TEXT,
  country TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  phone TEXT,
  whatsapp TEXT,
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_level INT NOT NULL DEFAULT 2 CHECK (price_level BETWEEN 1 AND 4),
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  delivery_enabled BOOLEAN NOT NULL DEFAULT true,
  reservation_enabled BOOLEAN NOT NULL DEFAULT true,
  min_order NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  prep_time_minutes INT NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurants public read"
ON public.restaurants FOR SELECT
USING (active = true OR owner_user_id = auth.uid());

CREATE POLICY "Owners insert own restaurant"
ON public.restaurants FOR INSERT
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update own restaurant"
ON public.restaurants FOR UPDATE
USING (owner_user_id = auth.uid());

CREATE POLICY "Owners delete own restaurant"
ON public.restaurants FOR DELETE
USING (owner_user_id = auth.uid());

CREATE TRIGGER trg_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_user_id);
CREATE INDEX idx_restaurants_city ON public.restaurants(city);

-- ============ MENU CATEGORIES ============
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu categories public read"
ON public.menu_categories FOR SELECT USING (true);

CREATE POLICY "Restaurant owners manage categories"
ON public.menu_categories FOR ALL
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE INDEX idx_menu_categories_restaurant ON public.menu_categories(restaurant_id);

-- ============ MENU ITEMS ============
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  image TEXT,
  gallery TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  spicy BOOLEAN NOT NULL DEFAULT false,
  vegetarian BOOLEAN NOT NULL DEFAULT false,
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu items public read"
ON public.menu_items FOR SELECT USING (true);

CREATE POLICY "Restaurant owners manage menu items"
ON public.menu_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);

-- ============ FOOD ORDERS ============
CREATE TABLE public.food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  contact_phone TEXT,
  notes TEXT,
  ref_code TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_tx_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_orders TO authenticated;
GRANT ALL ON public.food_orders TO service_role;

ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers read own food orders"
ON public.food_orders FOR SELECT
USING (buyer_id = auth.uid()
   OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE POLICY "Buyers create own food orders"
ON public.food_orders FOR INSERT
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyer or restaurant owner update food orders"
ON public.food_orders FOR UPDATE
USING (buyer_id = auth.uid()
   OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE TRIGGER trg_food_orders_updated_at
BEFORE UPDATE ON public.food_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_food_orders_buyer ON public.food_orders(buyer_id);
CREATE INDEX idx_food_orders_restaurant ON public.food_orders(restaurant_id);

-- ============ TABLE RESERVATIONS ============
CREATE TABLE public.table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  party_size INT NOT NULL DEFAULT 2,
  reserved_for TIMESTAMPTZ NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_reservations TO authenticated;
GRANT ALL ON public.table_reservations TO service_role;

ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservations read own or owner"
ON public.table_reservations FOR SELECT
USING (guest_id = auth.uid()
   OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE POLICY "Guests create reservations"
ON public.table_reservations FOR INSERT
WITH CHECK (guest_id = auth.uid());

CREATE POLICY "Guest or owner update reservation"
ON public.table_reservations FOR UPDATE
USING (guest_id = auth.uid()
   OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()));

CREATE TRIGGER trg_table_reservations_updated_at
BEFORE UPDATE ON public.table_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reservations_guest ON public.table_reservations(guest_id);
CREATE INDEX idx_reservations_restaurant ON public.table_reservations(restaurant_id);

-- ============ NOTIFICATIONS ============
CREATE OR REPLACE FUNCTION public.notify_new_food_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_uid uuid; r_name text;
BEGIN
  SELECT owner_user_id, name INTO owner_uid, r_name FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'food_order_new', 'New food order',
      'Order $' || to_char(NEW.total,'FM999990.00') || ' for ' || COALESCE(r_name,'your restaurant'),
      '/store/actions?section=restaurants&id=' || NEW.id);
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.buyer_id, 'food_order_submitted', 'Order placed',
    'We sent your order to ' || COALESCE(r_name,'the restaurant'),
    '/orders?ref=' || NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_food_order_new
AFTER INSERT ON public.food_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_food_order();

CREATE OR REPLACE FUNCTION public.notify_food_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.buyer_id, 'food_order_status', 'Order ' || NEW.status,
    'Your food order is now ' || NEW.status,
    CASE WHEN NEW.status IN ('accepted','confirmed') AND NOT COALESCE(NEW.paid,false)
         THEN '/pay/food-order/' || NEW.id
         ELSE '/orders?ref=' || NEW.id END);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_food_order_status
AFTER UPDATE ON public.food_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_food_order_status();

CREATE OR REPLACE FUNCTION public.notify_new_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_uid uuid; r_name text;
BEGIN
  SELECT owner_user_id, name INTO owner_uid, r_name FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'reservation_new', 'New table reservation',
      COALESCE(NEW.contact_name,'A guest') || ' booked for ' || NEW.party_size || ' on ' || to_char(NEW.reserved_for,'Mon DD HH24:MI'),
      '/store/actions?section=restaurants&res=' || NEW.id);
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.guest_id, 'reservation_submitted', 'Reservation requested',
    'We sent your booking to ' || COALESCE(r_name,'the restaurant'),
    '/orders?ref=' || NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_reservation_new
AFTER INSERT ON public.table_reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_new_reservation();

CREATE OR REPLACE FUNCTION public.notify_reservation_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.guest_id, 'reservation_status', 'Reservation ' || NEW.status,
    'Your table reservation is now ' || NEW.status,
    '/orders?ref=' || NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_reservation_status
AFTER UPDATE ON public.table_reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_status();

-- ============ ADD video_url TO EXISTING LISTING TABLES ============
ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.car_rentals ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.finance_products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.industrial_listings ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.agro_listings ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS gallery TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
