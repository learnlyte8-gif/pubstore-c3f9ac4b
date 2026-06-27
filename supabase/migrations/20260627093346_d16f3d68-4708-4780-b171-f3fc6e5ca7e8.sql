
-- Products: hot list queries (active=true ordered by sold/created_at/rating)
CREATE INDEX IF NOT EXISTS idx_products_active_sold       ON public.products (sold DESC)        WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_created    ON public.products (created_at DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_rating     ON public.products (rating DESC)     WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_active_moq_created ON public.products (moq, created_at DESC) WHERE active = true;

-- Suppliers: verified filter + owner lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_verified ON public.suppliers (verified) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_suppliers_owner    ON public.suppliers (owner_id);

-- Profiles: phone tail lookup needs trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_trgm ON public.profiles USING gin (phone gin_trgm_ops);

-- Messages: unread count style queries (conversation_id, sender_id, created_at)
CREATE INDEX IF NOT EXISTS idx_messages_conv_sender_created
  ON public.messages (conversation_id, sender_id, created_at DESC);

-- Notifications: unread by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC) WHERE read = false;

-- whatsapp_inbound_log: keep table from growing unbounded by indexing matched user and pruning helper
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_log_created ON public.whatsapp_inbound_log (created_at DESC);

-- whatsapp_link_codes: lookups by code/consumed_phone
CREATE INDEX IF NOT EXISTS idx_wa_link_codes_code         ON public.whatsapp_link_codes (code) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wa_link_codes_consumed_phone ON public.whatsapp_link_codes (consumed_phone) WHERE consumed_at IS NOT NULL;
