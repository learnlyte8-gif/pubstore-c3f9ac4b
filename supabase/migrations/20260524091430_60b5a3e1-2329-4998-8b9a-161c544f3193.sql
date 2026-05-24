
-- STAY BOOKINGS
CREATE OR REPLACE FUNCTION public.notify_new_stay_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE host_uid uuid; stay_title text; guest_name text;
BEGIN
  SELECT s.owner_id, st.title INTO host_uid, stay_title
    FROM public.stays st JOIN public.suppliers s ON s.id = st.supplier_id
    WHERE st.id = NEW.stay_id;
  SELECT COALESCE(display_name, username, 'A guest') INTO guest_name FROM public.profiles WHERE user_id = NEW.guest_id;
  IF host_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (host_uid, 'stay_booking_new',
      'New booking request',
      COALESCE(guest_name,'A guest') || ' booked ' || COALESCE(stay_title,'your stay') || ' (' || NEW.nights || ' night' || CASE WHEN NEW.nights>1 THEN 's' ELSE '' END || ')',
      '/store/actions');
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.guest_id, 'stay_booking_submitted',
    'Booking sent',
    'We sent your booking request for ' || COALESCE(stay_title,'your stay'),
    '/orders');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_stay_booking_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE stay_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO stay_title FROM public.stays WHERE id = NEW.stay_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.guest_id, 'stay_booking_status',
    'Booking ' || NEW.status,
    COALESCE(stay_title,'Your stay') || ' booking is now ' || NEW.status,
    '/orders');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_stay_booking ON public.stay_bookings;
CREATE TRIGGER trg_notify_new_stay_booking AFTER INSERT ON public.stay_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_new_stay_booking();
DROP TRIGGER IF EXISTS trg_notify_stay_booking_status ON public.stay_bookings;
CREATE TRIGGER trg_notify_stay_booking_status AFTER UPDATE OF status ON public.stay_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_stay_booking_status();

-- CAR RENTAL BOOKINGS
CREATE OR REPLACE FUNCTION public.notify_new_car_rental_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_uid uuid; rental_title text;
BEGIN
  SELECT owner_user_id, title INTO owner_uid, rental_title FROM public.car_rentals WHERE id = NEW.rental_id;
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'car_rental_booking_new',
      'New rental request',
      'Pickup ' || to_char(NEW.pickup_at, 'Mon DD') || ' — ' || COALESCE(rental_title,'your vehicle'),
      '/store/actions');
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.renter_id, 'car_rental_booking_submitted',
    'Rental request sent',
    'We sent your request for ' || COALESCE(rental_title,'the vehicle'),
    '/orders');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_car_rental_booking_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rental_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO rental_title FROM public.car_rentals WHERE id = NEW.rental_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.renter_id, 'car_rental_booking_status',
    'Rental ' || NEW.status,
    COALESCE(rental_title,'Your rental') || ' is now ' || NEW.status,
    '/orders');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_car_rental_booking ON public.car_rental_bookings;
CREATE TRIGGER trg_notify_new_car_rental_booking AFTER INSERT ON public.car_rental_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_new_car_rental_booking();
DROP TRIGGER IF EXISTS trg_notify_car_rental_booking_status ON public.car_rental_bookings;
CREATE TRIGGER trg_notify_car_rental_booking_status AFTER UPDATE OF status ON public.car_rental_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_car_rental_booking_status();

-- PROPERTY INQUIRIES
CREATE OR REPLACE FUNCTION public.notify_new_property_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_uid uuid; prop_title text;
BEGIN
  SELECT owner_user_id, title INTO owner_uid, prop_title FROM public.properties WHERE id = NEW.property_id;
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'property_inquiry_new',
      'New property inquiry',
      COALESCE(NEW.inquirer_name,'Someone') || ' is interested in ' || COALESCE(prop_title,'your property'),
      '/store/actions');
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.inquirer_id, 'property_inquiry_submitted',
    'Inquiry sent',
    'We sent your inquiry for ' || COALESCE(prop_title,'the property'),
    '/orders');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_property_inquiry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prop_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO prop_title FROM public.properties WHERE id = NEW.property_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.inquirer_id, 'property_inquiry_status',
    'Inquiry ' || NEW.status,
    'Your inquiry for ' || COALESCE(prop_title,'a property') || ' is now ' || NEW.status,
    '/orders');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_property_inquiry ON public.property_inquiries;
CREATE TRIGGER trg_notify_new_property_inquiry AFTER INSERT ON public.property_inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_new_property_inquiry();
DROP TRIGGER IF EXISTS trg_notify_property_inquiry_status ON public.property_inquiries;
CREATE TRIGGER trg_notify_property_inquiry_status AFTER UPDATE OF status ON public.property_inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_property_inquiry_status();

-- FINANCE APPLICATIONS
CREATE OR REPLACE FUNCTION public.notify_new_finance_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_uid uuid; prod_title text;
BEGIN
  SELECT owner_user_id, title INTO owner_uid, prod_title FROM public.finance_products WHERE id = NEW.product_id;
  IF owner_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (owner_uid, 'finance_application_new',
      'New finance application',
      COALESCE(NEW.applicant_name,'Someone') || ' applied for ' || COALESCE(prod_title,'your product') ||
        CASE WHEN NEW.amount_requested IS NOT NULL THEN ' — $' || to_char(NEW.amount_requested,'FM999G999G990') ELSE '' END,
      '/store/actions');
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.applicant_id, 'finance_application_submitted',
    'Application sent',
    'We sent your finance application for ' || COALESCE(prod_title,'the product'),
    '/orders');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_finance_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prod_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO prod_title FROM public.finance_products WHERE id = NEW.product_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.applicant_id, 'finance_application_status',
    'Application ' || NEW.status,
    'Your application for ' || COALESCE(prod_title,'a finance product') || ' is now ' || NEW.status,
    '/orders');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_finance_application ON public.finance_applications;
CREATE TRIGGER trg_notify_new_finance_application AFTER INSERT ON public.finance_applications FOR EACH ROW EXECUTE FUNCTION public.notify_new_finance_application();
DROP TRIGGER IF EXISTS trg_notify_finance_application_status ON public.finance_applications;
CREATE TRIGGER trg_notify_finance_application_status AFTER UPDATE OF status ON public.finance_applications FOR EACH ROW EXECUTE FUNCTION public.notify_finance_application_status();

-- VEHICLE INQUIRIES
CREATE OR REPLACE FUNCTION public.notify_new_vehicle_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dealer_uid uuid; veh_title text;
BEGIN
  SELECT s.owner_id, v.title INTO dealer_uid, veh_title
    FROM public.vehicles v JOIN public.suppliers s ON s.id = v.supplier_id
    WHERE v.id = NEW.vehicle_id;
  IF dealer_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (dealer_uid, 'vehicle_inquiry_new',
      'New vehicle ' || NEW.kind,
      COALESCE(NEW.contact_name,'A buyer') || ' is interested in ' || COALESCE(veh_title,'your vehicle'),
      '/store/actions');
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.buyer_id, 'vehicle_inquiry_submitted',
    'Inquiry sent',
    'We sent your inquiry for ' || COALESCE(veh_title,'the vehicle'),
    '/orders');
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_vehicle_inquiry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE veh_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO veh_title FROM public.vehicles WHERE id = NEW.vehicle_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.buyer_id, 'vehicle_inquiry_status',
    'Inquiry ' || NEW.status,
    'Your inquiry for ' || COALESCE(veh_title,'a vehicle') || ' is now ' || NEW.status,
    '/orders');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_vehicle_inquiry ON public.vehicle_inquiries;
CREATE TRIGGER trg_notify_new_vehicle_inquiry AFTER INSERT ON public.vehicle_inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_new_vehicle_inquiry();
DROP TRIGGER IF EXISTS trg_notify_vehicle_inquiry_status ON public.vehicle_inquiries;
CREATE TRIGGER trg_notify_vehicle_inquiry_status AFTER UPDATE OF status ON public.vehicle_inquiries FOR EACH ROW EXECUTE FUNCTION public.notify_vehicle_inquiry_status();

-- LOGISTICS BIDS
CREATE OR REPLACE FUNCTION public.notify_new_logistics_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE buyer_uid uuid; req_title text;
BEGIN
  SELECT buyer_id, title INTO buyer_uid, req_title FROM public.logistics_requests WHERE id = NEW.request_id;
  IF buyer_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (buyer_uid, 'logistics_bid_new',
      'New courier bid',
      COALESCE(NEW.driver_name,'A driver') || ' bid $' || to_char(NEW.fare,'FM999990.00') || ' on ' || COALESCE(req_title,'your delivery'),
      '/logistics');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_logistics_bid_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO req_title FROM public.logistics_requests WHERE id = NEW.request_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.driver_id, 'logistics_bid_status',
    'Bid ' || NEW.status,
    'Your bid on ' || COALESCE(req_title,'a delivery') || ' is now ' || NEW.status,
    '/logistics');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_logistics_bid ON public.logistics_bids;
CREATE TRIGGER trg_notify_new_logistics_bid AFTER INSERT ON public.logistics_bids FOR EACH ROW EXECUTE FUNCTION public.notify_new_logistics_bid();
DROP TRIGGER IF EXISTS trg_notify_logistics_bid_status ON public.logistics_bids;
CREATE TRIGGER trg_notify_logistics_bid_status AFTER UPDATE OF status ON public.logistics_bids FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_bid_status();

-- LOGISTICS REQUEST STATUS / ASSIGNMENT
CREATE OR REPLACE FUNCTION public.notify_logistics_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.buyer_id, 'logistics_status',
      'Delivery ' || NEW.status,
      COALESCE(NEW.title,'Your delivery') || ' is now ' || NEW.status,
      '/logistics');
  END IF;
  IF NEW.assigned_driver_id IS NOT NULL AND NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.assigned_driver_id, 'logistics_assigned',
      'You were assigned a delivery',
      COALESCE(NEW.title,'A delivery') || ' — pickup ' || COALESCE(NEW.pickup_address,''),
      '/driver');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_logistics_request_status ON public.logistics_requests;
CREATE TRIGGER trg_notify_logistics_request_status AFTER UPDATE ON public.logistics_requests FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_request_status();

-- SERVICE BIDS
CREATE OR REPLACE FUNCTION public.notify_new_service_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE buyer_uid uuid; req_title text;
BEGIN
  SELECT buyer_id, title INTO buyer_uid, req_title FROM public.service_requests WHERE id = NEW.request_id;
  IF buyer_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (buyer_uid, 'service_bid_new',
      'New service bid',
      COALESCE(NEW.provider_name,'A provider') || ' bid $' || to_char(NEW.price,'FM999990.00') || ' on ' || COALESCE(req_title,'your request'),
      '/services');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_service_bid_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO req_title FROM public.service_requests WHERE id = NEW.request_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.provider_user_id, 'service_bid_status',
    'Bid ' || NEW.status,
    'Your bid on ' || COALESCE(req_title,'a service request') || ' is now ' || NEW.status,
    '/services');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_service_bid ON public.service_bids;
CREATE TRIGGER trg_notify_new_service_bid AFTER INSERT ON public.service_bids FOR EACH ROW EXECUTE FUNCTION public.notify_new_service_bid();
DROP TRIGGER IF EXISTS trg_notify_service_bid_status ON public.service_bids;
CREATE TRIGGER trg_notify_service_bid_status AFTER UPDATE OF status ON public.service_bids FOR EACH ROW EXECUTE FUNCTION public.notify_service_bid_status();

-- SERVICE REQUEST STATUS / ASSIGNMENT
CREATE OR REPLACE FUNCTION public.notify_service_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.buyer_id, 'service_request_status',
      'Service ' || NEW.status,
      COALESCE(NEW.title,'Your request') || ' is now ' || NEW.status,
      '/services');
  END IF;
  IF NEW.assigned_provider_id IS NOT NULL AND NEW.assigned_provider_id IS DISTINCT FROM OLD.assigned_provider_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.assigned_provider_id, 'service_request_assigned',
      'You were awarded a service request',
      COALESCE(NEW.title,'A request'),
      '/services');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_service_request_status ON public.service_requests;
CREATE TRIGGER trg_notify_service_request_status AFTER UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.notify_service_request_status();
