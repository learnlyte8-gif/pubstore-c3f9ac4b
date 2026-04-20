
-- ============ ENUMS ============
CREATE TYPE public.order_status AS ENUM ('placed','processing','shipped','delivered','cancelled');
CREATE TYPE public.rfq_status AS ENUM ('open','closed');
CREATE TYPE public.live_status AS ENUM ('scheduled','live','ended');

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  slug text UNIQUE,
  country text,
  country_code text,
  years_active int DEFAULT 0,
  response_rate int DEFAULT 0,
  response_time text,
  on_time_delivery int DEFAULT 0,
  rating numeric(3,2) DEFAULT 0,
  verified boolean DEFAULT false,
  gold boolean DEFAULT false,
  trade_assurance boolean DEFAULT false,
  logo text,
  banner text,
  about text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers are public" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Owner inserts supplier" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates supplier" ON public.suppliers FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes supplier" ON public.suppliers FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image text,
  gallery text[] DEFAULT '{}',
  price numeric(12,2) NOT NULL DEFAULT 0,
  original_price numeric(12,2),
  category_slug text,
  badge text,
  free_shipping boolean DEFAULT false,
  moq int DEFAULT 1,
  unit text DEFAULT 'piece',
  lead_time text,
  ship_from text,
  specs jsonb DEFAULT '[]'::jsonb,
  rating numeric(3,2) DEFAULT 0,
  review_count int DEFAULT 0,
  sold int DEFAULT 0,
  has_reel boolean DEFAULT false,
  reel_url text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_supplier ON public.products(supplier_id);
CREATE INDEX idx_products_category ON public.products(category_slug);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "Supplier owner inserts product" ON public.products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Supplier owner updates product" ON public.products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Supplier owner deletes product" ON public.products FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCT VARIANTS ============
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  option_name text NOT NULL,
  image text,
  sort_order int DEFAULT 0
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variants public read" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Owner manages variants" ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.suppliers s ON s.id = p.supplier_id WHERE p.id = product_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.suppliers s ON s.id = p.supplier_id WHERE p.id = product_id AND s.owner_id = auth.uid()));

-- ============ PRODUCT TIER PRICES ============
CREATE TABLE public.product_tier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_qty int NOT NULL,
  price numeric(12,2) NOT NULL
);
ALTER TABLE public.product_tier_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tiers public read" ON public.product_tier_prices FOR SELECT USING (true);
CREATE POLICY "Owner manages tiers" ON public.product_tier_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.suppliers s ON s.id = p.supplier_id WHERE p.id = product_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.suppliers s ON s.id = p.supplier_id WHERE p.id = product_id AND s.owner_id = auth.uid()));

-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text,
  country text,
  variant text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_product ON public.reviews(product_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Auth users create review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates review" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner deletes review" ON public.reviews FOR DELETE USING (auth.uid() = user_id);

-- ============ ADDRESSES ============
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  recipient text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text,
  region text,
  postal text,
  country text,
  phone text,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own addresses select" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own addresses insert" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own addresses update" ON public.addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own addresses delete" ON public.addresses FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PAYMENT METHODS (display only, no real card data) ============
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand text NOT NULL,
  last4 text NOT NULL,
  exp_month int,
  exp_year int,
  holder text,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own pm select" ON public.payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own pm insert" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own pm update" ON public.payment_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own pm delete" ON public.payment_methods FOR DELETE USING (auth.uid() = user_id);

-- ============ CART ============
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cart all" ON public.cart_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ WISHLIST ============
CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own wishlist all" ON public.wishlist_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'placed',
  ship_to text,
  address_id uuid,
  tracking text,
  eta date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  ref_code text UNIQUE DEFAULT ('PUB-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*99999))::text,5,'0')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_supplier ON public.orders(supplier_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or supplier reads order" ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Buyer creates order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyer or supplier updates order" ON public.orders FOR UPDATE
  USING (auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORDER ITEMS ============
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty int NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  title text,
  image text
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items follow order" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = o.supplier_id AND s.owner_id = auth.uid()))));
CREATE POLICY "Buyer inserts order items" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

-- ============ RFQ ============
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  title text NOT NULL,
  category text,
  qty int NOT NULL DEFAULT 1,
  unit text,
  target_price numeric(12,2),
  ship_to text,
  details text,
  status public.rfq_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RFQs public read" ON public.rfqs FOR SELECT USING (true);
CREATE POLICY "Buyer creates rfq" ON public.rfqs FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Owner updates rfq" ON public.rfqs FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY "Owner deletes rfq" ON public.rfqs FOR DELETE USING (auth.uid() = buyer_id);
CREATE TRIGGER trg_rfqs_updated BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QUOTES ============
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  price_per_unit numeric(12,2) NOT NULL,
  lead_time text,
  moq int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quotes visible to rfq buyer or supplier owner" ON public.quotes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND r.buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );
CREATE POLICY "Supplier creates quote" ON public.quotes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Supplier deletes own quote" ON public.quotes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));

-- ============ CONVERSATIONS / MESSAGES ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, supplier_id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conv visible to participants" ON public.conversations FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );
CREATE POLICY "Buyer starts conversation" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants update conversation" ON public.conversations FOR UPDATE
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid())
  );

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages visible to participants" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()))
  ));
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()))
    )
  );

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications all" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ FOLLOWERS ============
CREATE TABLE public.followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, supplier_id)
);
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Followers public read" ON public.followers FOR SELECT USING (true);
CREATE POLICY "User follows" ON public.followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User unfollows" ON public.followers FOR DELETE USING (auth.uid() = user_id);

-- ============ LIVE STREAMS ============
CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover text,
  status public.live_status NOT NULL DEFAULT 'live',
  viewer_count int NOT NULL DEFAULT 0,
  pinned_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live streams public" ON public.live_streams FOR SELECT USING (true);
CREATE POLICY "Owner creates stream" ON public.live_streams FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owner updates stream" ON public.live_streams FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owner deletes stream" ON public.live_streams FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.owner_id = auth.uid()));

CREATE TABLE public.live_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_messages_stream ON public.live_messages(stream_id, created_at);
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live msgs public read" ON public.live_messages FOR SELECT USING (true);
CREATE POLICY "Auth users post live msg" ON public.live_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Streamer deletes msg" ON public.live_messages FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.live_streams ls JOIN public.suppliers s ON s.id = ls.supplier_id WHERE ls.id = stream_id AND s.owner_id = auth.uid()));

CREATE TABLE public.live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'heart',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions public read" ON public.live_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users react" ON public.live_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.live_streams REPLICA IDENTITY FULL;
ALTER TABLE public.live_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- ============ SEED CATEGORIES ============
INSERT INTO public.categories (slug, name, icon, sort_order) VALUES
  ('electronics','Electronics','Smartphone',1),
  ('fashion','Fashion','Shirt',2),
  ('home','Home & Garden','Home',3),
  ('beauty','Beauty','Sparkles',4),
  ('sports','Sports','Dumbbell',5),
  ('toys','Toys','ToyBrick',6),
  ('automotive','Automotive','Car',7),
  ('industrial','Industrial','Factory',8),
  ('agriculture','Agriculture','Sprout',9),
  ('packaging','Packaging','Package',10),
  ('office','Office','Briefcase',11),
  ('health','Health','HeartPulse',12);
