
CREATE POLICY "chat-media auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY "chat-media auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media' AND owner = auth.uid());
CREATE POLICY "chat-media auth delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-media' AND owner = auth.uid());
