-- Verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  id_card_url text NOT NULL,
  proof_residency_url text NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own verification select"
  ON public.user_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Own verification insert"
  ON public.user_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own verification update"
  ON public.user_verifications FOR UPDATE
  USING (auth.uid() = user_id AND status <> 'approved');

CREATE POLICY "Supplier reviews verifications"
  ON public.user_verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.owner_id = auth.uid())
  );

CREATE POLICY "Supplier updates verification status"
  ON public.user_verifications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.owner_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_verifications_updated_at
  BEFORE UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_cod_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_verifications
    WHERE user_id = _user_id AND status = 'approved'
  );
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own verification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own verification docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own verification docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Suppliers read verification docs for review"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verifications'
    AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.owner_id = auth.uid())
  );