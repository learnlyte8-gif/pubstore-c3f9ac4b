ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS forwarded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id);

DO $$ BEGIN
  CREATE POLICY "Senders can delete own messages"
    ON public.messages FOR DELETE
    USING (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can react"
    ON public.messages FOR UPDATE
    USING (EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()
        ))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.suppliers s WHERE s.id = c.supplier_id AND s.owner_id = auth.uid()
        ))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;