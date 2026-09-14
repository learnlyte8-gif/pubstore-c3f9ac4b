CREATE OR REPLACE FUNCTION public.notify_peer(
  _user_id uuid,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF _title IS NULL OR btrim(_title) = '' THEN RAISE EXCEPTION 'title required'; END IF;
  IF _type NOT IN ('follower','rfq_quote','order','inquiry_approved','inquiry','store') THEN
    RAISE EXCEPTION 'unsupported notification type: %', _type;
  END IF;
  IF _user_id = auth.uid() THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, left(_title, 120), left(coalesce(_body, ''), 300), _link)
  RETURNING id INTO nid;
  RETURN nid;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_peer(uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_peer(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_peer(uuid, text, text, text, text) TO service_role;