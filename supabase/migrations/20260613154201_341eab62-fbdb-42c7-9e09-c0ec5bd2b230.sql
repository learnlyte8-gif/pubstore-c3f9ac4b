
CREATE OR REPLACE FUNCTION public.serve_ad(_placement ad_placement, _category text DEFAULT NULL::text, _country text DEFAULT NULL::text, _interests text[] DEFAULT '{}'::text[], _limit integer DEFAULT 1)
 RETURNS TABLE(id uuid, product_id uuid, supplier_id uuid, placement ad_placement, pricing_mode ad_pricing_mode, creative jsonb, max_bid_cpc numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      OR _interests IS NULL
      OR cardinality(_interests) = 0
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
END $function$;
