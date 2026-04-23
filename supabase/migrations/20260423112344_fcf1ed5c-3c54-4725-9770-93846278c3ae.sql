-- Give every mirror supplier a unique deterministic banner & logo using DiceBear/Picsum services seeded by their id
UPDATE public.suppliers
SET
  logo = 'https://api.dicebear.com/7.x/shapes/svg?seed=' || id::text || '&backgroundType=gradientLinear',
  banner = 'https://picsum.photos/seed/' || replace(id::text, '-', '') || '/800/300'
WHERE mirror_of IS NOT NULL;