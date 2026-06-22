
-- 1. platform_settings (key/value)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings read auth" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings admin write" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (key, value)
VALUES ('manual_topup', jsonb_build_object(
  'enabled', true,
  'number', '',
  'name', 'PUBSTORE',
  'instructions', 'Send the EcoCash payment to the number above, then submit the confirmation reference and amount here. Your balance will be credited once the platform team verifies the payment.'
))
ON CONFLICT (key) DO NOTHING;

-- 2. manual_topups
CREATE TABLE IF NOT EXISTS public.manual_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL,
  note TEXT,
  platform_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined
  admin_note TEXT,
  credited_tx_id UUID,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_topups_user_idx ON public.manual_topups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_topups_status_idx ON public.manual_topups(status, created_at DESC);
GRANT SELECT, INSERT ON public.manual_topups TO authenticated;
GRANT ALL ON public.manual_topups TO service_role;
ALTER TABLE public.manual_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual_topups owner read" ON public.manual_topups
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "manual_topups owner insert" ON public.manual_topups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "manual_topups admin update" ON public.manual_topups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER manual_topups_updated_at
  BEFORE UPDATE ON public.manual_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Approve / decline manual topup
CREATE OR REPLACE FUNCTION public.approve_manual_topup(_id UUID, _admin_note TEXT DEFAULT NULL)
RETURNS public.manual_topups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  t public.manual_topups;
  tx public.wallet_transactions;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO t FROM public.manual_topups WHERE id = _id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'topup not found'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'topup already %', t.status; END IF;

  tx := public.apply_wallet_transaction(
    t.user_id, 'manual_topup', t.amount,
    'Manual EcoCash top-up · ref ' || COALESCE(t.reference, '-'),
    t.id::text, 'personal'
  );

  UPDATE public.manual_topups
     SET status = 'approved',
         admin_note = COALESCE(_admin_note, admin_note),
         credited_tx_id = tx.id,
         processed_by = uid,
         processed_at = now()
   WHERE id = _id
   RETURNING * INTO t;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (t.user_id, 'manual_topup_approved',
    'Top-up approved',
    'Your $' || to_char(t.amount,'FM999990.00') || ' EcoCash top-up was credited to PUBSTORE Pay.',
    '/wallet');

  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.decline_manual_topup(_id UUID, _admin_note TEXT DEFAULT NULL)
RETURNS public.manual_topups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); t public.manual_topups;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.manual_topups
     SET status='declined', admin_note=_admin_note, processed_by=uid, processed_at=now()
   WHERE id=_id AND status='pending'
   RETURNING * INTO t;
  IF t.id IS NULL THEN RAISE EXCEPTION 'topup not pending'; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (t.user_id, 'manual_topup_declined', 'Top-up declined',
    COALESCE(_admin_note, 'The platform team could not verify your manual top-up.'), '/wallet');
  RETURN t;
END $$;

-- 4. Approve / decline withdrawal (admin)
CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(_id UUID, _admin_note TEXT DEFAULT NULL)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); w public.withdrawal_requests;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.withdrawal_requests
     SET status='approved', admin_note=COALESCE(_admin_note, admin_note), processed_at=now()
   WHERE id=_id AND status='pending'
   RETURNING * INTO w;
  IF w.id IS NULL THEN RAISE EXCEPTION 'withdrawal not pending'; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (w.user_id, 'withdrawal_approved', 'Withdrawal approved',
    'Your $' || to_char(w.amount,'FM999990.00') || ' withdrawal via ' || w.method || ' is being paid out.',
    '/wallet');
  RETURN w;
END $$;

CREATE OR REPLACE FUNCTION public.decline_withdrawal_request(_id UUID, _admin_note TEXT DEFAULT NULL)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid(); w public.withdrawal_requests; ref TEXT;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF w.id IS NULL OR w.status <> 'pending' THEN RAISE EXCEPTION 'withdrawal not pending'; END IF;
  ref := 'WTHR-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);
  PERFORM public.apply_wallet_transaction(
    w.user_id, 'withdrawal_refund', w.amount,
    'Withdrawal declined · refund', ref, COALESCE(w.account,'personal')
  );
  UPDATE public.withdrawal_requests
     SET status='declined', admin_note=COALESCE(_admin_note, admin_note), processed_at=now()
   WHERE id=_id RETURNING * INTO w;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (w.user_id, 'withdrawal_declined', 'Withdrawal declined',
    COALESCE(_admin_note, 'Your withdrawal was declined and funds were refunded to your balance.'),
    '/wallet');
  RETURN w;
END $$;

-- 5. Assign admin role to kukistacks8@gmail.com (if user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
WHERE u.email = 'kukistacks8@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
