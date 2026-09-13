CREATE POLICY "Signed in users can view active ad templates"
ON public.ad_templates FOR SELECT TO authenticated
USING (active);