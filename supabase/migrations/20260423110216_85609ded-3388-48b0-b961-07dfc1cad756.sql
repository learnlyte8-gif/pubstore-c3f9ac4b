-- 1. Add mirror_of column
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS mirror_of UUID REFERENCES public.suppliers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_suppliers_mirror_of ON public.suppliers(mirror_of);

-- 2. Verify all stores owned by kukistacks8@gmail.com
UPDATE public.suppliers
SET verified = TRUE
WHERE owner_id IN (SELECT id FROM auth.users WHERE email = 'kukistacks8@gmail.com');

-- 3. Helper function to resolve a mirror back to its master supplier id
CREATE OR REPLACE FUNCTION public.resolve_master_supplier(_supplier_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(s.mirror_of, s.id)
  FROM public.suppliers s
  WHERE s.id = _supplier_id;
$$;