-- PUBSTORE Pay wallet
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own wallet select" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own wallet insert" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup','purchase','refund','adjustment')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  description text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_tx_user_created_idx
  ON public.wallet_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own tx select" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_wallet_transaction(
  _user_id uuid,
  _kind text,
  _amount numeric,
  _description text DEFAULT NULL,
  _reference text DEFAULT NULL
) RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
  tx public.wallet_transactions;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;

  INSERT INTO public.wallets (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
    SET balance = balance + _amount,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO new_balance;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  INSERT INTO public.wallet_transactions
    (user_id, kind, amount, balance_after, description, reference)
    VALUES (_user_id, _kind, _amount, new_balance, _description, _reference)
    RETURNING * INTO tx;

  RETURN tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(_order_id uuid)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL OR o.buyer_id <> uid THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  RETURN public.apply_wallet_transaction(
    uid, 'purchase', -o.total,
    'Order ' || COALESCE(o.ref_code, o.id::text),
    o.id::text
  );
END;
$$;