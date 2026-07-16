
-- =========================================================================
-- 1. user_roles: block self-assignment of admin
-- =========================================================================
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own role" ON public.user_roles;

CREATE POLICY "Users self-assign non-privileged role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role <> 'admin'::app_role);

CREATE POLICY "Users delete own non-privileged role"
  ON public.user_roles FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND role <> 'admin'::app_role);

CREATE POLICY "Admins manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 2. notifications: tighten peer-insert policy to only "New message" notifs
-- =========================================================================
DROP POLICY IF EXISTS "Users can insert peer notifications" ON public.notifications;

CREATE POLICY "Users can insert peer message notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IS NOT NULL
    AND user_id <> auth.uid()
    AND type = 'message'
    AND title = 'New message'
    AND link = '/messages'
    AND coalesce(char_length(body), 0) <= 200
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = notifications.conversation_id
        AND (c.buyer_id = auth.uid()
             OR c.supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.owner_id = auth.uid()))
    )
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = notifications.conversation_id
        AND (c.buyer_id = notifications.user_id
             OR c.supplier_id IN (SELECT s.id FROM public.suppliers s WHERE s.owner_id = notifications.user_id))
    )
  );

-- =========================================================================
-- 3. orders: block direct escrow/payment writes + provide safe RPCs
-- =========================================================================
CREATE OR REPLACE FUNCTION public._orders_block_escrow_tamper()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  claims text := current_setting('request.jwt.claims', true);
  role text := NULL;
BEGIN
  IF claims IS NOT NULL AND claims <> '' THEN
    role := (claims::jsonb ->> 'role');
  END IF;
  IF role IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.allow_escrow_write', true) = 'yes' THEN
    RETURN NEW;
  END IF;
  IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
     OR NEW.escrow_amount IS DISTINCT FROM OLD.escrow_amount
     OR NEW.escrow_released_at IS DISTINCT FROM OLD.escrow_released_at
     OR NEW.dispute_opened_at IS DISTINCT FROM OLD.dispute_opened_at
     OR NEW.dispute_reason IS DISTINCT FROM OLD.dispute_reason
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'escrow/payment fields must be changed via server-side function';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS orders_block_escrow_tamper_trg ON public.orders;
CREATE TRIGGER orders_block_escrow_tamper_trg
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._orders_block_escrow_tamper();

CREATE OR REPLACE FUNCTION public.release_escrow(_order_id uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE o public.orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'only the buyer can release escrow'; END IF;
  IF o.status::text <> 'delivered' THEN RAISE EXCEPTION 'order must be delivered before escrow can be released'; END IF;
  IF COALESCE(o.escrow_status, 'none') <> 'held' THEN RAISE EXCEPTION 'no funds are being held in escrow for this order'; END IF;
  PERFORM set_config('app.allow_escrow_write', 'yes', true);
  UPDATE public.orders
    SET escrow_status = 'released', escrow_released_at = now(), updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;
  RETURN o;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.open_order_dispute(_order_id uuid, _reason text)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE o public.orders; is_party boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'reason required'; END IF;
  IF char_length(_reason) > 500 THEN RAISE EXCEPTION 'reason too long (max 500 chars)'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  SELECT (o.buyer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = o.supplier_id AND s.owner_id = auth.uid())
    INTO is_party;
  IF NOT is_party THEN RAISE EXCEPTION 'not a party to this order'; END IF;
  IF COALESCE(o.escrow_status, 'none') NOT IN ('held','released') THEN RAISE EXCEPTION 'no escrow to dispute'; END IF;
  PERFORM set_config('app.allow_escrow_write', 'yes', true);
  UPDATE public.orders
    SET escrow_status = 'disputed', dispute_opened_at = now(), dispute_reason = left(_reason, 500), updated_at = now()
    WHERE id = _order_id RETURNING * INTO o;
  RETURN o;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_escrow(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_order_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_order_dispute(uuid, text) TO authenticated;

-- =========================================================================
-- 4. PII tables — require authentication for SELECT
-- =========================================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Couriers viewable by everyone" ON public.courier_profiles;
CREATE POLICY "Couriers viewable by authenticated users"
  ON public.courier_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Driver profiles public read" ON public.driver_profiles;
CREATE POLICY "Driver profiles authenticated read"
  ON public.driver_profiles FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "Driver locations public" ON public.driver_locations;
CREATE POLICY "Driver locations authenticated read"
  ON public.driver_locations FOR SELECT TO authenticated USING (online = true);

DROP POLICY IF EXISTS "Service providers public read" ON public.service_providers;
CREATE POLICY "Service providers authenticated read"
  ON public.service_providers FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "Car rentals public read" ON public.car_rentals;
CREATE POLICY "Car rentals authenticated read"
  ON public.car_rentals FOR SELECT TO authenticated
  USING (active = true OR auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Rides public discovery" ON public.rides;
CREATE POLICY "Rides discovery for authenticated"
  ON public.rides FOR SELECT TO authenticated
  USING (status = ANY (ARRAY['searching'::text, 'offered'::text]));

-- =========================================================================
-- 5. Storage: block anon listing on public buckets
-- =========================================================================
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Service media public read" ON storage.objects;
DROP POLICY IF EXISTS "Job media public read" ON storage.objects;
DROP POLICY IF EXISTS "Supplier certs public read" ON storage.objects;
DROP POLICY IF EXISTS "RFQ attachments are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Inspection report files are public" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant media public read" ON storage.objects;

CREATE POLICY "Product images list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Service media list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'service-media');
CREATE POLICY "Job media list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'job-media');
CREATE POLICY "Supplier certs list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'supplier-certs');
CREATE POLICY "RFQ attachments list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'rfq-attachments');
CREATE POLICY "Inspection reports list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'inspection-reports');
CREATE POLICY "Restaurant media list (auth)" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'restaurant-media');

-- =========================================================================
-- 6. Function search_path fixes
-- =========================================================================
ALTER FUNCTION public.get_email_by_username(text) SET search_path = public;
ALTER FUNCTION public.tier_from_points(numeric) SET search_path = public;
ALTER FUNCTION public.products_search_vector_update() SET search_path = public;

-- =========================================================================
-- 7. Revoke SECURITY DEFINER function execution from anon; restrict
--    internal helpers from authenticated too.
-- =========================================================================
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC', r.proname, r.args);
  END LOOP;
END $do$;

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef = true
      AND (
        p.proname LIKE E'\\_%'
        OR p.proname IN (
          'apply_wallet_transaction','approve_manual_topup','approve_withdrawal_request',
          'decline_manual_topup','decline_withdrawal_request','dispatch_notification_push',
          'email_queue_dispatch','email_queue_wake','handle_new_user','increment_coupon_uses',
          'increment_job_applicants','auto_confirm_special_email','notify_buyer_on_inquiry_decision',
          'notify_car_rental_booking_status','notify_finance_application_status','notify_followers_live',
          'notify_followers_new_product','notify_food_order_status','notify_group_buy_invite',
          'notify_job_application_status','notify_job_connection','notify_logistics_bid_status',
          'notify_logistics_request_status','notify_new_car_rental_booking','notify_new_job_application',
          'notify_new_order','notify_new_property_inquiry','notify_new_reservation','notify_new_service_bid',
          'notify_new_shared_trip_join','notify_new_stay_booking','notify_new_vehicle_inquiry',
          'notify_order_status','notify_reservation_status','notify_shared_trip_join_status',
          'notify_stay_booking_status','notify_user_follow','notify_vehicle_inquiry_status',
          'notify_wishlist_price_drop','notify_wishlist_restock','on_group_buy_join',
          'products_search_vector_update','recompute_product_rating','recompute_user_tier',
          'send_expo_push_on_notification','send_product_suggestions','shared_trip_join_set_amount',
          'set_updated_at','update_updated_at_column'
        )
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
  END LOOP;
END $do$;

-- Re-grant execute on functions the client legitimately calls.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef = true
      AND p.proname IN (
        'has_role','get_user_tier_info','is_conversation_member','is_group_buy_member',
        'is_group_buy_owner','is_cod_verified','match_shared_trips','personalized_feed',
        'redeem_loyalty_points','request_wallet_withdrawal','transfer_wallet_funds',
        'move_sales_to_personal','cancel_withdrawal_request','create_whatsapp_link_code',
        'bootstrap_group_buy','release_escrow','open_order_dispute','get_email_by_username'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
  END LOOP;
END $do$;
