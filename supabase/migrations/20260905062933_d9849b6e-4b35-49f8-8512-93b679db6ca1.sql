GRANT EXECUTE ON FUNCTION public.serve_ad(ad_placement, text, text, text[], integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_buy_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_buy_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO anon, authenticated;