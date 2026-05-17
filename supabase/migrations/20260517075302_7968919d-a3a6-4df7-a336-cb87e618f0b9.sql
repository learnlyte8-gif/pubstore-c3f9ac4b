CREATE TABLE IF NOT EXISTS public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_kind text NOT NULL,
  item_id text NOT NULL,
  title text,
  image text,
  href text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_kind, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user_kind ON public.saved_items (user_id, item_kind);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own saves read"   ON public.saved_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own saves insert" ON public.saved_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own saves delete" ON public.saved_items FOR DELETE USING (auth.uid() = user_id);