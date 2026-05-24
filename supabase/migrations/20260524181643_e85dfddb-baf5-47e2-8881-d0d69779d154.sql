
-- Helper: drop-and-create trigger pattern via DO blocks for idempotency

-- handle_new_user on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS auto_confirm_special_email_trg ON auth.users;
CREATE TRIGGER auto_confirm_special_email_trg
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_special_email();

-- Orders
DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

DROP TRIGGER IF EXISTS trg_notify_order_status ON public.orders;
CREATE TRIGGER trg_notify_order_status AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

-- Messages
DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Quotes (RFQ)
DROP TRIGGER IF EXISTS trg_notify_new_quote ON public.quotes;
CREATE TRIGGER trg_notify_new_quote AFTER INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_quote();

-- Followers
DROP TRIGGER IF EXISTS trg_notify_followers_new_product ON public.products;
CREATE TRIGGER trg_notify_followers_new_product AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_new_product();

DROP TRIGGER IF EXISTS trg_notify_wishlist_restock ON public.products;
CREATE TRIGGER trg_notify_wishlist_restock AFTER UPDATE OF active ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_restock();

DROP TRIGGER IF EXISTS trg_notify_wishlist_price_drop ON public.products;
CREATE TRIGGER trg_notify_wishlist_price_drop AFTER UPDATE OF price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_price_drop();

-- Reviews → recompute rating
DROP TRIGGER IF EXISTS trg_recompute_product_rating ON public.reviews;
CREATE TRIGGER trg_recompute_product_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();

-- Live streams
DROP TRIGGER IF EXISTS trg_notify_followers_live ON public.live_streams;
CREATE TRIGGER trg_notify_followers_live AFTER UPDATE OF status ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_live();

-- User follows
DROP TRIGGER IF EXISTS trg_notify_user_follow ON public.user_follows;
CREATE TRIGGER trg_notify_user_follow AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_follow();

-- Group buys
DROP TRIGGER IF EXISTS trg_bootstrap_group_buy ON public.group_buys;
CREATE TRIGGER trg_bootstrap_group_buy AFTER INSERT ON public.group_buys
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_group_buy();

DROP TRIGGER IF EXISTS trg_on_group_buy_join ON public.group_buy_members;
CREATE TRIGGER trg_on_group_buy_join AFTER INSERT ON public.group_buy_members
  FOR EACH ROW EXECUTE FUNCTION public.on_group_buy_join();

DROP TRIGGER IF EXISTS trg_notify_group_buy_invite ON public.group_buy_invites;
CREATE TRIGGER trg_notify_group_buy_invite AFTER INSERT ON public.group_buy_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_buy_invite();

-- Inquiries (product)
DROP TRIGGER IF EXISTS trg_notify_buyer_on_inquiry_decision ON public.product_inquiries;
CREATE TRIGGER trg_notify_buyer_on_inquiry_decision AFTER UPDATE ON public.product_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_buyer_on_inquiry_decision();

-- Vehicle inquiries
DROP TRIGGER IF EXISTS trg_notify_new_vehicle_inquiry ON public.vehicle_inquiries;
CREATE TRIGGER trg_notify_new_vehicle_inquiry AFTER INSERT ON public.vehicle_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_vehicle_inquiry();

DROP TRIGGER IF EXISTS trg_notify_vehicle_inquiry_status ON public.vehicle_inquiries;
CREATE TRIGGER trg_notify_vehicle_inquiry_status AFTER UPDATE ON public.vehicle_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_vehicle_inquiry_status();

-- Property inquiries
DROP TRIGGER IF EXISTS trg_notify_new_property_inquiry ON public.property_inquiries;
CREATE TRIGGER trg_notify_new_property_inquiry AFTER INSERT ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_property_inquiry();

DROP TRIGGER IF EXISTS trg_notify_property_inquiry_status ON public.property_inquiries;
CREATE TRIGGER trg_notify_property_inquiry_status AFTER UPDATE ON public.property_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_property_inquiry_status();

-- Stay bookings
DROP TRIGGER IF EXISTS trg_notify_new_stay_booking ON public.stay_bookings;
CREATE TRIGGER trg_notify_new_stay_booking AFTER INSERT ON public.stay_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_stay_booking();

DROP TRIGGER IF EXISTS trg_notify_stay_booking_status ON public.stay_bookings;
CREATE TRIGGER trg_notify_stay_booking_status AFTER UPDATE ON public.stay_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_stay_booking_status();

-- Car rental bookings
DROP TRIGGER IF EXISTS trg_notify_new_car_rental_booking ON public.car_rental_bookings;
CREATE TRIGGER trg_notify_new_car_rental_booking AFTER INSERT ON public.car_rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_car_rental_booking();

DROP TRIGGER IF EXISTS trg_notify_car_rental_booking_status ON public.car_rental_bookings;
CREATE TRIGGER trg_notify_car_rental_booking_status AFTER UPDATE ON public.car_rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_car_rental_booking_status();

-- Finance applications
DROP TRIGGER IF EXISTS trg_notify_new_finance_application ON public.finance_applications;
CREATE TRIGGER trg_notify_new_finance_application AFTER INSERT ON public.finance_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_finance_application();

DROP TRIGGER IF EXISTS trg_notify_finance_application_status ON public.finance_applications;
CREATE TRIGGER trg_notify_finance_application_status AFTER UPDATE ON public.finance_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_finance_application_status();

-- Service requests & bids
DROP TRIGGER IF EXISTS trg_notify_service_request_status ON public.service_requests;
CREATE TRIGGER trg_notify_service_request_status AFTER UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_request_status();

DROP TRIGGER IF EXISTS trg_notify_new_service_bid ON public.service_bids;
CREATE TRIGGER trg_notify_new_service_bid AFTER INSERT ON public.service_bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_service_bid();

DROP TRIGGER IF EXISTS trg_notify_service_bid_status ON public.service_bids;
CREATE TRIGGER trg_notify_service_bid_status AFTER UPDATE ON public.service_bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_bid_status();

-- Logistics requests & bids
DROP TRIGGER IF EXISTS trg_notify_logistics_request_status ON public.logistics_requests;
CREATE TRIGGER trg_notify_logistics_request_status AFTER UPDATE ON public.logistics_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_request_status();

DROP TRIGGER IF EXISTS trg_notify_new_logistics_bid ON public.logistics_bids;
CREATE TRIGGER trg_notify_new_logistics_bid AFTER INSERT ON public.logistics_bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_logistics_bid();

DROP TRIGGER IF EXISTS trg_notify_logistics_bid_status ON public.logistics_bids;
CREATE TRIGGER trg_notify_logistics_bid_status AFTER UPDATE ON public.logistics_bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_bid_status();

-- Shared trips (ride-share)
DROP TRIGGER IF EXISTS trg_shared_trip_join_set_amount ON public.shared_trip_joins;
CREATE TRIGGER trg_shared_trip_join_set_amount BEFORE INSERT ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.shared_trip_join_set_amount();

DROP TRIGGER IF EXISTS trg_notify_new_shared_trip_join ON public.shared_trip_joins;
CREATE TRIGGER trg_notify_new_shared_trip_join AFTER INSERT ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_shared_trip_join();

DROP TRIGGER IF EXISTS trg_notify_shared_trip_join_status ON public.shared_trip_joins;
CREATE TRIGGER trg_notify_shared_trip_join_status AFTER UPDATE ON public.shared_trip_joins
  FOR EACH ROW EXECUTE FUNCTION public.notify_shared_trip_join_status();

-- Job postings / applications / connections
DROP TRIGGER IF EXISTS trg_notify_new_job_application ON public.job_applications;
CREATE TRIGGER trg_notify_new_job_application AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_job_application();

DROP TRIGGER IF EXISTS trg_increment_job_applicants ON public.job_applications;
CREATE TRIGGER trg_increment_job_applicants AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.increment_job_applicants();

DROP TRIGGER IF EXISTS trg_notify_job_application_status ON public.job_applications;
CREATE TRIGGER trg_notify_job_application_status AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_application_status();

DROP TRIGGER IF EXISTS trg_notify_job_connection ON public.job_connections;
CREATE TRIGGER trg_notify_job_connection AFTER INSERT OR UPDATE ON public.job_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_connection();

-- Coupons
DROP TRIGGER IF EXISTS trg_increment_coupon_uses ON public.coupon_redemptions;
CREATE TRIGGER trg_increment_coupon_uses AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_uses();

-- Dispatch push notifications on every new notification row
DROP TRIGGER IF EXISTS trg_dispatch_notification_push ON public.notifications;
CREATE TRIGGER trg_dispatch_notification_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_push();
