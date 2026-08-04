
-- ============ CATALOG TABLES ============
CREATE TABLE public.ai_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  price_usd numeric NOT NULL DEFAULT 0,
  monthly_credits integer NOT NULL DEFAULT 0,
  blurb text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_plans TO anon, authenticated;
GRANT ALL ON public.ai_plans TO service_role;
ALTER TABLE public.ai_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_plans readable" ON public.ai_plans FOR SELECT USING (true);

CREATE TABLE public.ai_credit_packs (
  code text PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  price_usd numeric NOT NULL,
  bonus_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_credit_packs TO anon, authenticated;
GRANT ALL ON public.ai_credit_packs TO service_role;
ALTER TABLE public.ai_credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_packs readable" ON public.ai_credit_packs FOR SELECT USING (true);

CREATE TABLE public.ai_feature_costs (
  feature text PRIMARY KEY,
  label text NOT NULL,
  credits integer NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.ai_feature_costs TO anon, authenticated;
GRANT ALL ON public.ai_feature_costs TO service_role;
ALTER TABLE public.ai_feature_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_feature_costs readable" ON public.ai_feature_costs FOR SELECT USING (true);

-- ============ USER STATE ============
CREATE TABLE public.ai_credit_accounts (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  plan_code text NOT NULL DEFAULT 'free' REFERENCES public.ai_plans(code),
  plan_started_at timestamptz,
  plan_renews_at timestamptz,
  trial_used integer NOT NULL DEFAULT 0,
  lifetime_credits_purchased integer NOT NULL DEFAULT 0,
  lifetime_credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_credit_accounts TO authenticated;
GRANT ALL ON public.ai_credit_accounts TO service_role;
ALTER TABLE public.ai_credit_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai account" ON public.ai_credit_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  kind text NOT NULL,
  feature text,
  description text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_credit_ledger_user_idx ON public.ai_credit_ledger (user_id, created_at DESC);
GRANT SELECT ON public.ai_credit_ledger TO authenticated;
GRANT ALL ON public.ai_credit_ledger TO service_role;
ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai ledger" ON public.ai_credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.ai_credits_account(_user_id uuid)
RETURNS public.ai_credit_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE acc public.ai_credit_accounts; allowance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  INSERT INTO public.ai_credit_accounts (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO acc FROM public.ai_credit_accounts WHERE user_id = _user_id;

  -- roll the monthly allowance when the period has elapsed
  IF acc.plan_renews_at IS NOT NULL AND acc.plan_renews_at <= now() THEN
    SELECT monthly_credits INTO allowance FROM public.ai_plans WHERE code = acc.plan_code;
    allowance := COALESCE(allowance, 0);
    UPDATE public.ai_credit_accounts
      SET balance = balance + allowance,
          plan_renews_at = now() + interval '1 month',
          updated_at = now()
      WHERE user_id = _user_id
      RETURNING * INTO acc;
    IF allowance > 0 THEN
      INSERT INTO public.ai_credit_ledger (user_id, delta, balance_after, kind, description)
      VALUES (_user_id, allowance, acc.balance, 'plan_renewal', 'Monthly ' || acc.plan_code || ' allowance');
    END IF;
  END IF;
  RETURN acc;
END; $$;

CREATE OR REPLACE FUNCTION public.ai_consume_credits(
  _user_id uuid, _feature text, _reference text DEFAULT NULL, _quantity integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE acc public.ai_credit_accounts; fc public.ai_feature_costs;
        cost integer; trial_cap constant integer := 10;
BEGIN
  acc := public.ai_credits_account(_user_id);
  SELECT * INTO fc FROM public.ai_feature_costs WHERE feature = _feature AND is_active;
  IF fc.feature IS NULL THEN RAISE EXCEPTION 'unknown ai feature %', _feature; END IF;
  cost := fc.credits * GREATEST(COALESCE(_quantity, 1), 1);

  -- free lifetime trial first
  IF acc.trial_used < trial_cap THEN
    UPDATE public.ai_credit_accounts
      SET trial_used = trial_used + 1, updated_at = now()
      WHERE user_id = _user_id RETURNING * INTO acc;
    INSERT INTO public.ai_credit_ledger (user_id, delta, balance_after, kind, feature, description, reference)
    VALUES (_user_id, 0, acc.balance, 'free_trial', _feature, fc.label || ' (free trial)', _reference);
    RETURN jsonb_build_object('ok', true, 'charged', 0, 'source', 'trial',
      'balance', acc.balance, 'trial_remaining', trial_cap - acc.trial_used);
  END IF;

  IF acc.balance < cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits',
      'required', cost, 'balance', acc.balance, 'feature', _feature);
  END IF;

  UPDATE public.ai_credit_accounts
    SET balance = balance - cost,
        lifetime_credits_spent = lifetime_credits_spent + cost,
        updated_at = now()
    WHERE user_id = _user_id RETURNING * INTO acc;
  INSERT INTO public.ai_credit_ledger (user_id, delta, balance_after, kind, feature, description, reference)
  VALUES (_user_id, -cost, acc.balance, 'spend', _feature, fc.label, _reference);

  RETURN jsonb_build_object('ok', true, 'charged', cost, 'source', 'balance',
    'balance', acc.balance, 'trial_remaining', 0);
END; $$;

CREATE OR REPLACE FUNCTION public.ai_buy_credit_pack(_pack_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); pack public.ai_credit_packs; acc public.ai_credit_accounts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO pack FROM public.ai_credit_packs WHERE code = _pack_code AND is_active;
  IF pack.code IS NULL THEN RAISE EXCEPTION 'unknown credit pack'; END IF;

  acc := public.ai_credits_account(uid);
  PERFORM public.apply_wallet_transaction(uid, 'purchase', -pack.price_usd,
    pack.credits || ' AI credits (' || pack.name || ')', 'ai_pack:' || pack.code, 'personal');

  UPDATE public.ai_credit_accounts
    SET balance = balance + pack.credits,
        lifetime_credits_purchased = lifetime_credits_purchased + pack.credits,
        updated_at = now()
    WHERE user_id = uid RETURNING * INTO acc;
  INSERT INTO public.ai_credit_ledger (user_id, delta, balance_after, kind, description, reference)
  VALUES (uid, pack.credits, acc.balance, 'purchase', pack.name, 'ai_pack:' || pack.code);

  RETURN jsonb_build_object('ok', true, 'credits', pack.credits, 'balance', acc.balance);
END; $$;

CREATE OR REPLACE FUNCTION public.ai_subscribe_plan(_plan_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); pl public.ai_plans; acc public.ai_credit_accounts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO pl FROM public.ai_plans WHERE code = _plan_code AND is_active;
  IF pl.code IS NULL THEN RAISE EXCEPTION 'unknown plan'; END IF;

  acc := public.ai_credits_account(uid);
  IF acc.plan_code = pl.code AND acc.plan_renews_at IS NOT NULL AND acc.plan_renews_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'balance', acc.balance);
  END IF;

  IF pl.price_usd > 0 THEN
    PERFORM public.apply_wallet_transaction(uid, 'purchase', -pl.price_usd,
      pl.name || ' AI plan (1 month)', 'ai_plan:' || pl.code, 'personal');
  END IF;

  UPDATE public.ai_credit_accounts
    SET plan_code = pl.code,
        plan_started_at = now(),
        plan_renews_at = CASE WHEN pl.price_usd > 0 THEN now() + interval '1 month' ELSE NULL END,
        balance = balance + pl.monthly_credits,
        lifetime_credits_purchased = lifetime_credits_purchased + pl.monthly_credits,
        updated_at = now()
    WHERE user_id = uid RETURNING * INTO acc;

  IF pl.monthly_credits > 0 THEN
    INSERT INTO public.ai_credit_ledger (user_id, delta, balance_after, kind, description, reference)
    VALUES (uid, pl.monthly_credits, acc.balance, 'plan_start', pl.name || ' allowance', 'ai_plan:' || pl.code);
  END IF;

  RETURN jsonb_build_object('ok', true, 'plan', pl.code, 'balance', acc.balance,
    'renews_at', acc.plan_renews_at);
END; $$;

REVOKE ALL ON FUNCTION public.ai_credits_account(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_consume_credits(uuid, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_buy_credit_pack(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscribe_plan(text) TO authenticated;

-- ============ SEED ============
INSERT INTO public.ai_plans (code, name, price_usd, monthly_credits, blurb, sort_order) VALUES
  ('free',     'Starter',  0,     0,    '10 free AI actions to try everything, then top up.', 1),
  ('plus',     'Plus',     9.99,  600,  'For everyday sellers using Tapson and AI ads.',      2),
  ('pro',      'Pro',      29.99, 2200, 'For power sellers running ads and bulk imports.',    3),
  ('business', 'Business', 79.99, 6500, 'For teams and high-volume AI workloads.',            4);

INSERT INTO public.ai_credit_packs (code, name, credits, price_usd, bonus_label, sort_order) VALUES
  ('pack_250',  'Small',  250,  5,  NULL,           1),
  ('pack_600',  'Medium', 600,  10, '+20% bonus',   2),
  ('pack_1600', 'Large',  1600, 25, '+28% bonus',   3),
  ('pack_4000', 'Bulk',   4000, 55, '+45% bonus',   4);

INSERT INTO public.ai_feature_costs (feature, label, credits, notes) VALUES
  ('tapson_chat',      'Tapson AI reply',        1,  'Shopping assistant message'),
  ('semantic_search',  'Smart search',           1,  'Embedding + vector search'),
  ('image_search',     'Search by photo',        2,  'Vision keyword extraction'),
  ('learnlyte_chat',   'Study assistant reply',  2,  'PDF-aware chat turn'),
  ('extract_questions','Extract exam questions', 15, 'Full paper parse'),
  ('mark_answers',     'Mark answers',           15, 'Full paper marking'),
  ('generate_ad',      'AI product ad',          20, 'Rewrites copy + reel flag');
