-- Register/refresh the caller's Expo push token, re-assigning a token row
-- that belongs to another user (device switched accounts). SECURITY DEFINER
-- so the upsert is never blocked by RLS visibility of the old row.
CREATE OR REPLACE FUNCTION public.register_expo_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'token required';
  END IF;

  INSERT INTO public.expo_push_tokens (user_id, token)
  VALUES (v_uid, trim(p_token))
  ON CONFLICT (token)
  DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now();
END;
$$;

-- Remove a token (sign-out / notifications disabled). Only removes rows the
-- caller owns unless they present the exact token string.
CREATE OR REPLACE FUNCTION public.unregister_expo_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.expo_push_tokens
  WHERE token = trim(p_token) AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_expo_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_expo_push_token(text) TO authenticated;

-- Tighten direct-write policies: the previous UPDATE policy had USING (true)
-- with no WITH CHECK, which let upserts produce rows Postgres then rejected
-- ("new row violates row-level security policy (USING expression)").
DROP POLICY IF EXISTS "Users can update push tokens for their device" ON public.expo_push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.expo_push_tokens;
DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.expo_push_tokens;

CREATE POLICY "Users can insert own push tokens"
  ON public.expo_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push tokens"
  ON public.expo_push_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());