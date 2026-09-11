INSERT INTO public.ad_templates (name, format, description, caption_prompt, style, active)
SELECT v.name, v.format, v.description, v.caption_prompt, v.style::jsonb, true
FROM (VALUES
  ('Pubstore catalog grid — square', 'square', 'Search bar on top, dark headline band, then a grid of white product cards with prices and BUY buttons.', 'Marketplace tone: category name, cheap price angle, ready-to-ship.', '{"bg":"#f97316","accent":"#ef4444","text":"#ffffff","layout":"catalog"}'),
  ('Pubstore catalog grid — reel', 'vertical', 'Vertical version of the catalog grid: search bar, headline band and six product cards.', 'Punchy scroll-stopper for reels, price-led.', '{"bg":"#2563eb","accent":"#f97316","text":"#ffffff","layout":"catalog"}'),
  ('Trade assurance catalog', 'square', 'Catalog grid with a trust angle — payment released only on delivery.', 'Lead with buyer protection and low prices.', '{"bg":"#0ea5e9","accent":"#f59e0b","text":"#ffffff","layout":"catalog"}'),
  ('Hero + moving row (video)', 'vertical', 'Hero product on top with a row of products sliding right to left underneath — export with Make video.', 'Short energetic lines that work over motion.', '{"bg":"#0f172a","accent":"#22c55e","text":"#ffffff","layout":"hero-five"}')
) AS v(name, format, description, caption_prompt, style)
WHERE NOT EXISTS (SELECT 1 FROM public.ad_templates t WHERE t.name = v.name);