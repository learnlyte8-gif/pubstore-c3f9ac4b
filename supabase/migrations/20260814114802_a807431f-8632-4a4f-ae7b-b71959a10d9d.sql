DROP POLICY IF EXISTS "Suppliers read verification docs for review" ON storage.objects;

CREATE POLICY "Admins read verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verifications' AND public.has_role(auth.uid(), 'admin'));
