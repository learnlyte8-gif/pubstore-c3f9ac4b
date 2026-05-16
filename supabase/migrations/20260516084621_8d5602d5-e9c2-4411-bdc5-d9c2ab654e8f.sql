
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS attachments TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('rfq-attachments', 'rfq-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "RFQ attachments are publicly viewable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'rfq-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload RFQ attachments to own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'rfq-attachments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own RFQ attachments"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'rfq-attachments'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
