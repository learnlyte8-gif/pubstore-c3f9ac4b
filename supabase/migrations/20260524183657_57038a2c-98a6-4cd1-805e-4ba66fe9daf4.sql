CREATE POLICY "Buyer can re-inquire" ON public.product_inquiries
FOR UPDATE TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);