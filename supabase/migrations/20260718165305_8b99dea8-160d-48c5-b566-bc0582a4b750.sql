GRANT EXECUTE ON FUNCTION public.approve_manual_topup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_manual_topup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_withdrawal_request(uuid, text) TO authenticated;