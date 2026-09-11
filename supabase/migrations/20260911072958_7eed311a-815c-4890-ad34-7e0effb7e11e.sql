alter table public.social_ads
  add column if not exists price numeric,
  add column if not exists original_price numeric;