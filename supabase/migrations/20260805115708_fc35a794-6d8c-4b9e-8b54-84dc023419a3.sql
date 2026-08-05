ALTER TABLE public.orders
  ADD CONSTRAINT orders_escrow_status_check
  CHECK (escrow_status IN ('none','held','disputed','released','refunded'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_refund_status_check
  CHECK (refund_status IN ('none','requested','declined','refunded'));

REVOKE EXECUTE ON FUNCTION public.supplier_mark_order_delivered(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buyer_confirm_order_delivered(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_order_refund(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_order_by_buyer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_order_refund(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.supplier_mark_order_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_confirm_order_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_refund(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_by_buyer(uuid) TO authenticated;