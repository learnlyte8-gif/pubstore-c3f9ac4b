CREATE OR REPLACE FUNCTION public.approve_manual_topup(_id uuid, _admin_note text DEFAULT NULL::text)
 RETURNS manual_topups
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  t public.manual_topups;
  tx public.wallet_transactions;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO t FROM public.manual_topups WHERE id = _id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'topup not found'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'topup already %', t.status; END IF;

  tx := public.apply_wallet_transaction(
    t.user_id, 'topup', t.amount,
    'Manual EcoCash top-up · ref ' || COALESCE(t.reference, '-'),
    t.id::text, 'personal'
  );

  UPDATE public.manual_topups
     SET status = 'approved',
         admin_note = COALESCE(_admin_note, admin_note),
         credited_tx_id = tx.id,
         processed_by = uid,
         processed_at = now()
   WHERE id = _id
   RETURNING * INTO t;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (t.user_id, 'manual_topup_approved',
    'Top-up approved',
    'Your $' || to_char(t.amount,'FM999990.00') || ' EcoCash top-up was credited to PUBSTORE Pay.',
    '/wallet');

  RETURN t;
END $function$;