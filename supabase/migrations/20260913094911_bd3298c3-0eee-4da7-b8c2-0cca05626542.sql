REVOKE ALL ON FUNCTION public._create_promo_commissions(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._promo_commissions_on_order_event() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_mature_commissions() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_short_code(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._create_promo_commissions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_mature_commissions() TO service_role;