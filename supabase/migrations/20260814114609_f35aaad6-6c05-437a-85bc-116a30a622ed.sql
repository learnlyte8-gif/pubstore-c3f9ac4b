-- Identity verification: admin-only review (remove the over-broad supplier rules)
DROP POLICY IF EXISTS "Supplier reviews verifications" ON public.user_verifications;
DROP POLICY IF EXISTS "Supplier updates verification status" ON public.user_verifications;

CREATE POLICY "Admins read verifications"
  ON public.user_verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins review verifications"
  ON public.user_verifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Abuse reports: admin triage
CREATE POLICY "Admins read all reports"
  ON public.user_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update reports"
  ON public.user_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete reports"
  ON public.user_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Moderation
CREATE POLICY "Admins update any product"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any product"
  ON public.products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete any review"
  ON public.reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any supplier"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Oversight
CREATE POLICY "Admins read all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
