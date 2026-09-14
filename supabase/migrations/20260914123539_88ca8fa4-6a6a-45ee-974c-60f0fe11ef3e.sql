ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS collection_point_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collection_point_address text,
  ADD COLUMN IF NOT EXISTS delivery_note text;