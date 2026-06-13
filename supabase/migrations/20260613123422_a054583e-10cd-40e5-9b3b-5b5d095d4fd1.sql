
-- =========================================================
-- PUBSTORE Ads Engine
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.ad_placement AS ENUM ('banner','inline','interstitial','rewarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_pricing_mode AS ENUM ('flat_boost','cpc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_status AS ENUM ('draft','active','paused','exhausted','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_event_kind AS ENUM ('impression','click','reward_view','conversion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- ad_campaigns
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL,
  supplier_id      UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_id       UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  placement        public.ad_placement NOT NULL,
  pricing_mode     public.ad_pricing_mode NOT NULL DEFAULT 'flat_boost',
  daily_budget     NUMERIC NOT NULL DEFAULT 1 CHECK (daily_budget >= 0),
  max_bid_cpc      NUMERIC NOT NULL DEFAULT 0 CHECK (max_bid_cpc >= 0),
  total_spent      NUMERIC NOT NULL DEFAULT 0,
  spent_today      NUMERIC NOT NULL DEFAULT 0,
  spent_today_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status           public.ad_status NOT NULL DEFAULT 'draft',
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at          TIMESTAMPTZ,
  creative         JSONB NOT NULL DEFAULT '{}'::jsonb,
  targeting        JSONB NOT NULL DEFAULT '{}'::jsonb,
  impressions      INTEGER NOT NULL DEFAULT 0,
  clicks           INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_campaigns_owner_idx ON public.ad_campaigns(owner_id);
CREATE INDEX IF NOT EXISTS ad_campaigns_active_idx ON public.ad_campaigns(status, placement);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT SELECT ON public.ad_campaigns TO anon;
GRANT ALL ON public.ad_campaigns TO service_role;

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their campaigns"
  ON public.ad_campaigns FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Active campaigns are publicly readable"
  ON public.ad_campaigns FOR SELECT
  USING (status = 'active');

CREATE TRIGGER ad_campaigns_set_updated
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ad_campaign_stats (daily rollup)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ad_campaign_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  conversions   INTEGER NOT NULL DEFAULT 0,
  spend         NUMERIC NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, date)
);

GRANT SELECT, INSERT, UPDATE ON public.ad_campaign_stats TO authenticated;
GRANT ALL ON public.ad_campaign_stats TO service_role;

ALTER TABLE public.ad_campaign_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their stats"
  ON public.ad_campaign_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ad_campaigns c
    WHERE c.id = ad_campaign_stats.campaign_id AND c.owner_id = auth.uid()
  ));

-- =========================================================
-- ad_events (raw log)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ad_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id      UUID,
  event        public.ad_event_kind NOT NULL,
  placement    public.ad_placement NOT NULL,
  charged      NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_events_campaign_idx ON public.ad_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_user_recent_idx ON public.ad_events(user_id, campaign_id, created_at DESC);

GRANT SELECT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their events"
  ON public.ad_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ad_campaigns c
    WHERE c.id = ad_events.campaign_id AND c.owner_id = auth.uid()
  ));

-- =========================================================
-- loyalty_points
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  user_id          UUID PRIMARY KEY,
  balance          INTEGER NOT NULL DEFAULT 0,
  lifetime_earned  INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own points"
  ON public.loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

-- =========================================================
-- loyalty_ledger
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_ledger_user_idx ON public.loyalty_ledger(user_id, created_at DESC);

GRANT SELECT ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own ledger"
  ON public.loyalty_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- Reset daily-spent counter helper (used inline)
CREATE OR REPLACE FUNCTION public._ad_reset_daily(_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.ad_campaigns
    SET spent_today = 0, spent_today_date = CURRENT_DATE
    WHERE id = _id AND spent_today_date <> CURRENT_DATE;
END $$;

-- Serve: pick best ad for a placement
CREATE OR REPLACE FUNCTION public.serve_ad(
  _placement public.ad_placement,
  _category  TEXT DEFAULT NULL,
  _country   TEXT DEFAULT NULL,
  _interests TEXT[] DEFAULT '{}'::TEXT[],
  _limit     INTEGER DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  supplier_id UUID,
  placement public.ad_placement,
  pricing_mode public.ad_pricing_mode,
  creative JSONB,
  max_bid_cpc NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT c.id, c.product_id, c.supplier_id, c.placement, c.pricing_mode, c.creative, c.max_bid_cpc
  FROM public.ad_campaigns c
  WHERE c.status = 'active'
    AND c.placement = _placement
    AND (c.ends_at IS NULL OR c.ends_at > now())
    AND c.starts_at <= now()
    AND (c.spent_today_date <> CURRENT_DATE OR c.spent_today < c.daily_budget)
    AND (
      NOT (c.targeting ? 'categories')
      OR jsonb_array_length(c.targeting->'categories') = 0
      OR _category IS NULL
      OR c.targeting->'categories' @> to_jsonb(_category)
    )
    AND (
      NOT (c.targeting ? 'countries')
      OR jsonb_array_length(c.targeting->'countries') = 0
      OR _country IS NULL
      OR c.targeting->'countries' @> to_jsonb(_country)
    )
    AND (
      NOT (c.targeting ? 'interests')
      OR jsonb_array_length(c.targeting->'interests') = 0
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(c.targeting->'interests') t
        WHERE t.value = ANY(_interests)
      )
    )
    AND (
      uid IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.ad_events e
        WHERE e.campaign_id = c.id
          AND e.user_id = uid
          AND e.event = 'impression'
          AND e.created_at > now() - interval '10 minutes'
      )
    )
  ORDER BY
    CASE WHEN c.pricing_mode = 'cpc' THEN c.max_bid_cpc ELSE 0 END DESC,
    CASE WHEN c.pricing_mode = 'flat_boost' THEN (c.daily_budget - c.spent_today) ELSE 0 END DESC,
    random()
  LIMIT _limit;
END $$;

-- Track event (impression / click)
CREATE OR REPLACE FUNCTION public.track_ad_event(
  _campaign_id UUID,
  _event       public.ad_event_kind,
  _placement   public.ad_placement
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid       UUID := auth.uid();
  c         public.ad_campaigns;
  charge    NUMERIC := 0;
  new_today NUMERIC;
BEGIN
  SELECT * INTO c FROM public.ad_campaigns WHERE id = _campaign_id;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'campaign not found'); END IF;

  PERFORM public._ad_reset_daily(c.id);
  SELECT * INTO c FROM public.ad_campaigns WHERE id = _campaign_id;

  -- Charge on click for CPC campaigns
  IF _event = 'click' AND c.pricing_mode = 'cpc' AND c.max_bid_cpc > 0 THEN
    charge := c.max_bid_cpc;
    BEGIN
      PERFORM public.apply_wallet_transaction(
        c.owner_id, 'ad_click', -charge,
        'Ad click · ' || c.name, c.id::text, 'personal'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Out of wallet funds → pause
      UPDATE public.ad_campaigns SET status = 'exhausted' WHERE id = c.id;
      RETURN jsonb_build_object('ok', false, 'error', 'advertiser wallet empty');
    END;
  END IF;

  INSERT INTO public.ad_events (campaign_id, user_id, event, placement, charged)
  VALUES (_campaign_id, uid, _event, _placement, charge);

  IF _event = 'impression' THEN
    UPDATE public.ad_campaigns
      SET impressions = impressions + 1
      WHERE id = _campaign_id;
  ELSIF _event = 'click' THEN
    new_today := c.spent_today + charge;
    UPDATE public.ad_campaigns
      SET clicks      = clicks + 1,
          total_spent = total_spent + charge,
          spent_today = new_today,
          status      = CASE WHEN new_today >= c.daily_budget AND c.pricing_mode = 'cpc'
                             THEN 'exhausted'::public.ad_status ELSE c.status END
      WHERE id = _campaign_id;
  END IF;

  INSERT INTO public.ad_campaign_stats (campaign_id, date, impressions, clicks, spend)
  VALUES (
    _campaign_id, CURRENT_DATE,
    CASE WHEN _event = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'click'      THEN 1 ELSE 0 END,
    charge
  )
  ON CONFLICT (campaign_id, date) DO UPDATE SET
    impressions = ad_campaign_stats.impressions + EXCLUDED.impressions,
    clicks      = ad_campaign_stats.clicks      + EXCLUDED.clicks,
    spend       = ad_campaign_stats.spend       + EXCLUDED.spend;

  RETURN jsonb_build_object('ok', true, 'charged', charge);
END $$;

-- Reward view (rewarded ads)
CREATE OR REPLACE FUNCTION public.reward_ad_view(_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid       UUID := auth.uid();
  c         public.ad_campaigns;
  today_cnt INTEGER;
  fee       NUMERIC := 0.05;
  pts       INTEGER := 5;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO c FROM public.ad_campaigns WHERE id = _campaign_id;
  IF c.id IS NULL OR c.placement <> 'rewarded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid campaign');
  END IF;

  SELECT COUNT(*) INTO today_cnt FROM public.ad_events
    WHERE user_id = uid AND event = 'reward_view'
      AND created_at::date = CURRENT_DATE;
  IF today_cnt >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily reward limit reached', 'points', 0);
  END IF;

  -- Charge advertiser (best-effort; pause if empty)
  BEGIN
    PERFORM public.apply_wallet_transaction(
      c.owner_id, 'ad_reward_view', -fee,
      'Rewarded view · ' || c.name, c.id::text, 'personal'
    );
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.ad_campaigns SET status = 'exhausted' WHERE id = c.id;
    RETURN jsonb_build_object('ok', false, 'error', 'advertiser wallet empty');
  END;

  -- Log event
  INSERT INTO public.ad_events (campaign_id, user_id, event, placement, charged)
  VALUES (_campaign_id, uid, 'reward_view', 'rewarded', fee);

  -- Credit points
  INSERT INTO public.loyalty_points (user_id, balance, lifetime_earned)
  VALUES (uid, pts, pts)
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = loyalty_points.balance + pts,
    lifetime_earned = loyalty_points.lifetime_earned + pts,
    updated_at      = now();

  INSERT INTO public.loyalty_ledger (user_id, delta, reason, reference)
  VALUES (uid, pts, 'rewarded_ad', c.id::text);

  -- Update campaign totals
  UPDATE public.ad_campaigns
    SET total_spent = total_spent + fee,
        spent_today = spent_today + fee
    WHERE id = c.id;

  INSERT INTO public.ad_campaign_stats (campaign_id, date, impressions, spend, points_awarded)
  VALUES (_campaign_id, CURRENT_DATE, 1, fee, pts)
  ON CONFLICT (campaign_id, date) DO UPDATE SET
    impressions    = ad_campaign_stats.impressions    + 1,
    spend          = ad_campaign_stats.spend          + EXCLUDED.spend,
    points_awarded = ad_campaign_stats.points_awarded + EXCLUDED.points_awarded;

  RETURN jsonb_build_object('ok', true, 'points', pts);
END $$;

-- Redeem points -> coupon
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(_points INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid    UUID := auth.uid();
  bal    INTEGER;
  value  NUMERIC;
  code   TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _points IS NULL OR _points < 100 OR _points % 100 <> 0 THEN
    RAISE EXCEPTION 'redeem in multiples of 100 points';
  END IF;

  SELECT balance INTO bal FROM public.loyalty_points WHERE user_id = uid;
  IF COALESCE(bal,0) < _points THEN RAISE EXCEPTION 'not enough points'; END IF;

  value := (_points / 100)::NUMERIC; -- $1 per 100 pts
  code  := 'PTS-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);

  UPDATE public.loyalty_points
    SET balance = balance - _points, updated_at = now()
    WHERE user_id = uid;

  INSERT INTO public.loyalty_ledger (user_id, delta, reason, reference)
  VALUES (uid, -_points, 'redeem_coupon', code);

  RETURN jsonb_build_object('ok', true, 'code', code, 'value', value);
END $$;
