UPDATE public.products
SET promote_enabled = true,
    commission_type = 'percent',
    commission_value = 5,
    commission_release_days = 7
WHERE active
  AND COALESCE(promote_enabled, false) = false
  AND category_slug IN ('electronics','fashion','beauty','home','accessories');