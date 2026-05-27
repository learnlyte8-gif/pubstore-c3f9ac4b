
-- Withdrawal requests for PUBSTORE Pay
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,           -- ecocash | onemoney | bank | paypal
  destination TEXT NOT NULL,      -- phone / account no / email
  account_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paid | rejected | cancelled
  reference TEXT NOT NULL,        -- shared with the wallet hold tx
  hold_tx_id UUID,                -- wallet_transactions.id for the held debit
  payout_tx_id UUID,              -- wallet_transactions.id for refund if rejected
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users cancel own pending withdrawals"
  ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','cancelled'));

CREATE TRIGGER trg_withdrawal_requests_updated
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_withdrawal_requests_user ON public.withdrawal_requests(user_id, created_at DESC);

-- RPC: request a withdrawal. Holds funds by debiting wallet immediately
-- and recording the request. On reject/cancel an admin (or the user) refunds.
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(
  _amount NUMERIC,
  _method TEXT,
  _destination TEXT,
  _account_name TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  ref TEXT;
  debit_tx public.wallet_transactions;
  req public.withdrawal_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount IS NULL OR _amount < 5 THEN RAISE EXCEPTION 'minimum withdrawal is $5.00'; END IF;
  IF _amount > 10000 THEN RAISE EXCEPTION 'amount exceeds per-request limit'; END IF;
  IF _method IS NULL OR length(trim(_method)) = 0 THEN RAISE EXCEPTION 'method required'; END IF;
  IF _destination IS NULL OR length(trim(_destination)) < 3 THEN RAISE EXCEPTION 'destination required'; END IF;

  ref := 'WTH-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);

  -- Hold funds (will throw on insufficient balance)
  debit_tx := public.apply_wallet_transaction(
    uid, 'withdrawal_hold', -_amount,
    'Withdrawal requested · ' || _method,
    ref
  );

  INSERT INTO public.withdrawal_requests
    (user_id, amount, method, destination, account_name, notes, reference, hold_tx_id, status)
  VALUES
    (uid, _amount, _method, _destination, _account_name, _notes, ref, debit_tx.id, 'pending')
  RETURNING * INTO req;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (uid, 'withdrawal_submitted',
    'Withdrawal request submitted',
    'We are processing your $' || to_char(_amount,'FM999990.00') || ' withdrawal via ' || _method,
    '/wallet');

  RETURN req;
END;
$$;

-- Allow user to cancel their own pending request and get a refund
CREATE OR REPLACE FUNCTION public.cancel_withdrawal_request(_id UUID)
RETURNS withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  req public.withdrawal_requests;
  refund_tx public.wallet_transactions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = _id;
  IF req.id IS NULL OR req.user_id <> uid THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'only pending requests can be cancelled'; END IF;

  refund_tx := public.apply_wallet_transaction(
    uid, 'refund', req.amount,
    'Withdrawal cancelled · refund',
    req.reference
  );

  UPDATE public.withdrawal_requests
    SET status = 'cancelled', payout_tx_id = refund_tx.id, processed_at = now()
    WHERE id = _id
    RETURNING * INTO req;

  RETURN req;
END;
$$;
