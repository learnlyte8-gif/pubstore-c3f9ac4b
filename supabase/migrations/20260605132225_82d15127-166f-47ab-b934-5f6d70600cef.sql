
-- 1. Allow invitees to SEE the group buy they were invited to (so they can join)
DROP POLICY IF EXISTS "group_buys visible" ON public.group_buys;
CREATE POLICY "group_buys visible" ON public.group_buys FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_group_buy_member(auth.uid(), id)
  OR EXISTS (SELECT 1 FROM public.group_buy_invites i WHERE i.group_id = group_buys.id AND i.invitee_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = group_buys.supplier_id AND s.owner_id = auth.uid())
);

-- 2. Allow invitees to see existing members (social proof before joining)
DROP POLICY IF EXISTS "group_buy_members visible to members" ON public.group_buy_members;
CREATE POLICY "group_buy_members visible" ON public.group_buy_members FOR SELECT USING (
  public.is_group_buy_member(auth.uid(), group_id)
  OR public.is_group_buy_owner(auth.uid(), group_id)
  OR EXISTS (SELECT 1 FROM public.group_buy_invites i WHERE i.group_id = group_buy_members.group_id AND i.invitee_id = auth.uid())
);

-- 3. RPC: owner converts a locked group buy into a single pooled order
CREATE OR REPLACE FUNCTION public.place_group_buy_order(_group_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  gb public.group_buys;
  prod public.products;
  pooled_qty integer;
  unit_price numeric;
  new_order public.orders;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO gb FROM public.group_buys WHERE id = _group_id;
  IF gb.id IS NULL THEN RAISE EXCEPTION 'group buy not found'; END IF;
  IF gb.owner_id <> uid THEN RAISE EXCEPTION 'only the group owner can place this order'; END IF;
  IF gb.status NOT IN ('open','locked') THEN RAISE EXCEPTION 'group buy is already %', gb.status; END IF;

  SELECT COALESCE(SUM(qty), 0) INTO pooled_qty FROM public.group_buy_members WHERE group_id = _group_id;
  IF pooled_qty < 1 THEN RAISE EXCEPTION 'no pledged units to order'; END IF;

  SELECT * INTO prod FROM public.products WHERE id = gb.product_id;
  IF prod.id IS NULL THEN RAISE EXCEPTION 'product no longer available'; END IF;

  unit_price := COALESCE(prod.price, 0);

  INSERT INTO public.orders (buyer_id, supplier_id, status, subtotal, total, payment_status)
  VALUES (uid, gb.supplier_id, 'placed', unit_price * pooled_qty, unit_price * pooled_qty, 'pending')
  RETURNING * INTO new_order;

  INSERT INTO public.order_items (order_id, product_id, qty, unit_price, title, image)
  VALUES (new_order.id, prod.id, pooled_qty, unit_price, prod.title,
          COALESCE(prod.image, CASE WHEN prod.gallery IS NOT NULL AND array_length(prod.gallery,1) > 0 THEN prod.gallery[1] ELSE NULL END));

  UPDATE public.group_buys SET status = 'fulfilled', updated_at = now() WHERE id = _group_id;

  -- Notify all members that the order has been placed
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT m.user_id, 'group_buy_ordered',
    'Group order placed',
    'Your group buy "' || gb.title || '" has been ordered (' || pooled_qty || ' units pooled)',
    '/orders?ref=' || new_order.id
  FROM public.group_buy_members m WHERE m.group_id = _group_id AND m.user_id <> uid;

  RETURN new_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_group_buy_order(uuid) TO authenticated;
