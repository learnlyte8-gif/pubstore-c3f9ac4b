WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at, id) - 1) % 4 AS bucket
  FROM public.suppliers
  WHERE mirror_of IS NOT NULL
)
UPDATE public.suppliers s
SET country = CASE r.bucket WHEN 0 THEN 'Zimbabwe' WHEN 1 THEN 'Botswana' WHEN 2 THEN 'Zambia' ELSE 'South Africa' END,
    country_code = CASE r.bucket WHEN 0 THEN 'ZW' WHEN 1 THEN 'BW' WHEN 2 THEN 'ZM' ELSE 'ZA' END
FROM ranked r
WHERE s.id = r.id;