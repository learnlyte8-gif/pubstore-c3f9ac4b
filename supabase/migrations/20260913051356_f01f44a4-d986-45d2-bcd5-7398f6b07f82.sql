ALTER TABLE public.social_ads ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.ad_templates (name, format, description, caption_prompt, style, active)
VALUES
  ('Shop card · single', 'square', 'Looks exactly like a Pubstore product card — one product, big image, price and buy button.', 'Write a short punchy caption for a single product deal.', '{"bg":"#f8fafc","accent":"#ea580c","text":"#0f172a","layout":"product-card"}', true),
  ('Shop card · single', 'vertical', 'Reel-sized product card with one hero product image, price and buy button.', 'Write a short punchy caption for a single product deal.', '{"bg":"#0f172a","accent":"#f97316","text":"#ffffff","layout":"product-card"}', true),
  ('Shop cards · multi', 'square', 'A grid of Pubstore-style product cards from the product gallery.', 'Write a caption promoting a bundle of picks.', '{"bg":"#0b1020","accent":"#22c55e","text":"#ffffff","layout":"product-card-multi"}', true),
  ('Shop cards · multi', 'vertical', 'Reel-sized stack of Pubstore-style product cards.', 'Write a caption promoting a bundle of picks.', '{"bg":"#0b1020","accent":"#22c55e","text":"#ffffff","layout":"product-card-multi"}', true);