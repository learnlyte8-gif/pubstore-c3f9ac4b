ALTER TABLE public.social_ads
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.social_ads
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND cardinality(image_urls) = 0;