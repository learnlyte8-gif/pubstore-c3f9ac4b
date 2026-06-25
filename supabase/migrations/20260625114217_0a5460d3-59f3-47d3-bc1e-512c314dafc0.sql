CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  consumed_at timestamptz,
  consumed_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walc_code_active ON public.whatsapp_link_codes(code) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_walc_user ON public.whatsapp_link_codes(user_id);
GRANT SELECT, INSERT ON public.whatsapp_link_codes TO authenticated;
GRANT ALL ON public.whatsapp_link_codes TO service_role;
ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_link_codes_select" ON public.whatsapp_link_codes;
CREATE POLICY "own_link_codes_select" ON public.whatsapp_link_codes FOR SELECT TO authenticated USING (user_id = auth.uid());

DO $$ BEGIN
  CREATE TYPE public.wa_code_purpose AS ENUM ('twofa','order_delivery','withdrawal','generic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose public.wa_code_purpose NOT NULL,
  reference text,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wavc_lookup ON public.whatsapp_verification_codes(user_id, purpose, reference) WHERE used_at IS NULL;
GRANT SELECT ON public.whatsapp_verification_codes TO authenticated;
GRANT ALL ON public.whatsapp_verification_codes TO service_role;
ALTER TABLE public.whatsapp_verification_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_codes_select" ON public.whatsapp_verification_codes;
CREATE POLICY "own_codes_select" ON public.whatsapp_verification_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.tapson_wa_threads (
  phone text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tapson_wa_threads TO service_role;
ALTER TABLE public.tapson_wa_threads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_code text;

CREATE OR REPLACE FUNCTION public.create_whatsapp_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  c := lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.whatsapp_link_codes
    SET consumed_at = now()
    WHERE user_id = uid AND consumed_at IS NULL;
  INSERT INTO public.whatsapp_link_codes (user_id, code) VALUES (uid, c);
  RETURN c;
END $$;
GRANT EXECUTE ON FUNCTION public.create_whatsapp_link_code() TO authenticated;